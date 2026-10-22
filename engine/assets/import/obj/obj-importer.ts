import * as vec3 from '@/engine/core/math/vec3';
import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { srgbToLinear } from '@/engine/core/color/srgb';
import { mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import type { FileBundle } from '../file-bundle';
import { triangulatePolygon, withSmoothNormals } from '../geometry-utils';
import { baseNameWithoutExtension, createImportedMaterial, createImportedNode, createImportedTexture, type ImportedMaterial, type ImportedMesh, type ImportedNode, type ImportedScene, type ImportedTexture, } from '../import-types';
import { parseMtl, type MtlMaterial, type MtlTextureMap } from './mtl-parser';
interface Corner {
    v: number;
    vt: number;
    vn: number;
}
interface Face {
    corners: Corner[];
    smoothing: number;
}
interface Part {
    object: string;
    group: string;
    material: string | null;
    faces: Face[];
}
interface ObjDocument {
    positions: number[];
    texcoords: number[];
    normals: number[];
    parts: Part[];
    materialLibraries: string[];
    sawSmoothing: boolean;
    skippedPrimitives: number;
}
function resolveIndex(token: string | undefined, count: number): number {
    if (!token)
        return -1;
    const value = Number.parseInt(token, 10);
    if (Number.isNaN(value) || value === 0)
        return -1;
    return value > 0 ? value - 1 : count + value;
}
function parseObj(text: string): ObjDocument {
    const doc: ObjDocument = { positions: [], texcoords: [], normals: [], parts: [], materialLibraries: [], sawSmoothing: false, skippedPrimitives: 0 };
    let object = '';
    let group = '';
    let material: string | null = null;
    let smoothing = 0;
    let current: Part | null = null;
    const partFor = (): Part => {
        if (current && current.object === object && current.group === group && current.material === material)
            return current;
        current = doc.parts.find((part) => part.object === object && part.group === group && part.material === material) ?? null;
        if (!current) {
            current = { object, group, material, faces: [] };
            doc.parts.push(current);
        }
        return current;
    };
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        while (line.endsWith('\\') && i + 1 < lines.length)
            line = line.slice(0, -1) + ' ' + lines[++i];
        line = line.trim();
        if (!line || line.startsWith('#'))
            continue;
        const tokens = line.split(/\s+/);
        const keyword = tokens[0];
        switch (keyword) {
            case 'v':
                doc.positions.push(Number(tokens[1]) || 0, Number(tokens[2]) || 0, Number(tokens[3]) || 0);
                break;
            case 'vt':
                doc.texcoords.push(Number(tokens[1]) || 0, Number(tokens[2]) || 0);
                break;
            case 'vn':
                doc.normals.push(Number(tokens[1]) || 0, Number(tokens[2]) || 0, Number(tokens[3]) || 0);
                break;
            case 'f': {
                const positionCount = doc.positions.length / 3;
                const texcoordCount = doc.texcoords.length / 2;
                const normalCount = doc.normals.length / 3;
                const corners: Corner[] = [];
                for (let t = 1; t < tokens.length; t++) {
                    const [v, vt, vn] = tokens[t].split('/');
                    const corner = { v: resolveIndex(v, positionCount), vt: resolveIndex(vt, texcoordCount), vn: resolveIndex(vn, normalCount) };
                    if (corner.v >= 0 && corner.v < positionCount)
                        corners.push(corner);
                }
                if (corners.length >= 3)
                    partFor().faces.push({ corners, smoothing });
                break;
            }
            case 'o':
                object = tokens.slice(1).join(' ');
                group = '';
                break;
            case 'g':
                group = tokens.slice(1).join(' ');
                break;
            case 'usemtl':
                material = tokens.slice(1).join(' ') || null;
                break;
            case 'mtllib':
                doc.materialLibraries.push(tokens.slice(1).join(' '));
                break;
            case 's': {
                const value = tokens[1]?.toLowerCase();
                smoothing = !value || value === 'off' || value === '0' ? 0 : Number.parseInt(value, 10) || 1;
                doc.sawSmoothing = true;
                break;
            }
            case 'l':
            case 'p':
                doc.skippedPrimitives++;
                break;
            default:
                break;
        }
    }
    return doc;
}
function smoothingGroupNormals(positions: number[], indices: number[], triangleSmoothing: number[], sourceVertex: number[]): Float32Array {
    const normals = new Float32Array(positions.length);
    const accumulators = new Map<string, [
        number,
        number,
        number
    ]>();
    const vertexAccumulator: Array<string | null> = new Array(positions.length / 3).fill(null);
    for (let t = 0; t < triangleSmoothing.length; t++) {
        const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
        const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
        const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
        const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];
        const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const group = triangleSmoothing[t];
        for (const vertex of [i0, i1, i2]) {
            if (group === 0) {
                const length = Math.hypot(nx, ny, nz) || 1;
                normals[vertex * 3] = nx / length;
                normals[vertex * 3 + 1] = ny / length;
                normals[vertex * 3 + 2] = nz / length;
                continue;
            }
            const key = `${sourceVertex[vertex]}/s${group}`;
            let sum = accumulators.get(key);
            if (!sum) {
                sum = [0, 0, 0];
                accumulators.set(key, sum);
            }
            sum[0] += nx;
            sum[1] += ny;
            sum[2] += nz;
            vertexAccumulator[vertex] = key;
        }
    }
    for (let vertex = 0; vertex < vertexAccumulator.length; vertex++) {
        const key = vertexAccumulator[vertex];
        if (!key)
            continue;
        const sum = accumulators.get(key)!;
        const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
        normals[vertex * 3] = sum[0] / length;
        normals[vertex * 3 + 1] = sum[1] / length;
        normals[vertex * 3 + 2] = sum[2] / length;
    }
    return normals;
}
function buildPartMesh(name: string, part: Part, doc: ObjDocument, materialIndex: number | null): ImportedMesh | null {
    const { positions, texcoords, normals } = doc;
    const triangleCorners: Corner[] = [];
    const triangleSmoothing: number[] = [];
    const scratch: number[] = [];
    for (const face of part.faces) {
        scratch.length = 0;
        triangulatePolygon(face.corners.length, (i) => {
            const v = face.corners[i].v * 3;
            return [positions[v], positions[v + 1], positions[v + 2]];
        }, scratch);
        for (let i = 0; i < scratch.length; i += 3) {
            triangleCorners.push(face.corners[scratch[i]], face.corners[scratch[i + 1]], face.corners[scratch[i + 2]]);
            triangleSmoothing.push(face.smoothing);
        }
    }
    if (triangleCorners.length === 0)
        return null;
    const normalCount = normals.length / 3;
    const texcoordCount = texcoords.length / 2;
    const hadNormals = triangleCorners.every((corner) => corner.vn >= 0 && corner.vn < normalCount);
    const hadUvs = triangleCorners.some((corner) => corner.vt >= 0 && corner.vt < texcoordCount);
    const useSmoothingGroups = !hadNormals && doc.sawSmoothing;
    const lookup = new Map<string, number>();
    const outPositions: number[] = [];
    const outUvs: number[] = [];
    const outNormals: number[] = [];
    const sourceVertex: number[] = [];
    const indices: number[] = [];
    for (let corner = 0; corner < triangleCorners.length; corner++) {
        const { v, vt, vn } = triangleCorners[corner];
        const triangle = Math.floor(corner / 3);
        const smoothing = triangleSmoothing[triangle];
        const key = hadNormals ? `${v}/${vt}/${vn}` : useSmoothingGroups ? (smoothing > 0 ? `${v}/${vt}/s${smoothing}` : `${v}/${vt}/f${triangle}`) : `${v}/${vt}`;
        let index = lookup.get(key);
        if (index === undefined) {
            index = outPositions.length / 3;
            lookup.set(key, index);
            outPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
            const validUv = vt >= 0 && vt < texcoordCount;
            outUvs.push(validUv ? texcoords[vt * 2] : 0, validUv ? 1 - texcoords[vt * 2 + 1] : 0);
            if (hadNormals)
                outNormals.push(normals[vn * 3], normals[vn * 3 + 1], normals[vn * 3 + 2]);
            sourceVertex.push(v);
        }
        indices.push(index);
    }
    let geometry: MeshData;
    if (hadNormals) {
        geometry = { name, positions: new Float32Array(outPositions), normals: new Float32Array(outNormals), uvs: new Float32Array(outUvs), indices: createIndexArray(indices, outPositions.length / 3) };
    }
    else if (useSmoothingGroups) {
        const computed = smoothingGroupNormals(outPositions, indices, triangleSmoothing, sourceVertex);
        geometry = { name, positions: new Float32Array(outPositions), normals: computed, uvs: new Float32Array(outUvs), indices: createIndexArray(indices, outPositions.length / 3) };
    }
    else {
        geometry = withSmoothNormals(name, outPositions, outUvs, indices);
    }
    return { name, geometry, material: materialIndex, hadNormals, hadUvs };
}
function srgbColor(color: [
    number,
    number,
    number
]): Float32Array {
    return vec3.create(srgbToLinear(color[0]), srgbToLinear(color[1]), srgbToLinear(color[2]));
}
function roughnessFromShininess(shininess: number | null): number {
    if (shininess === null || Number.isNaN(shininess))
        return 0.6;
    return Math.min(1, Math.max(0, 1 - Math.sqrt(Math.min(Math.max(shininess, 0), 1000) / 1000)));
}
class TextureTable {
    readonly textures: ImportedTexture[] = [];
    private readonly byPath = new Map<string, number>();
    constructor(private readonly bundle: FileBundle, private readonly sourcePath: string, private readonly warnings: string[]) { }
    add(map: MtlTextureMap | undefined): number | null {
        if (!map)
            return null;
        const key = map.path.replace(/\\/g, '/').toLowerCase();
        const existing = this.byPath.get(key);
        if (existing !== undefined)
            return existing;
        const file = this.bundle.resolve(map.path, this.sourcePath);
        if (!file)
            this.warnings.push(`Textura não encontrada: "${map.path}". Selecione-a junto com o modelo.`);
        const wrap = map.clamp ? 'clamp' : 'repeat';
        const texture = createImportedTexture(baseNameWithoutExtension(map.path), map.path, file, file?.type || mimeTypeFromFileName(map.path), { wrapS: wrap, wrapT: wrap });
        const index = this.textures.length;
        this.textures.push(texture);
        this.byPath.set(key, index);
        return index;
    }
}
function convertMaterial(mtl: MtlMaterial, textures: TextureTable, warnings: string[]): ImportedMaterial {
    const out = createImportedMaterial(mtl.name);
    if (mtl.diffuse)
        out.baseColor = srgbColor(mtl.diffuse);
    else if (mtl.maps.diffuse)
        out.baseColor = vec3.create(1, 1, 1);
    if (mtl.emissive)
        out.emissive = srgbColor(mtl.emissive);
    out.roughness = mtl.roughness ?? roughnessFromShininess(mtl.shininess);
    out.metallic = mtl.metallic ?? 0;
    out.opacity = Number.isNaN(mtl.dissolve) ? 1 : Math.min(1, Math.max(0, mtl.dissolve));
    if (out.opacity < 1)
        out.alphaMode = 'blend';
    else if (mtl.maps.dissolve)
        out.alphaMode = 'mask';
    out.baseColorMap = textures.add(mtl.maps.diffuse);
    out.emissiveMap = textures.add(mtl.maps.emissive);
    if (out.emissiveMap !== null && !mtl.emissive)
        out.emissive = vec3.create(1, 1, 1);
    out.occlusionMap = textures.add(mtl.maps.occlusion);
    out.roughnessMap = textures.add(mtl.maps.roughness);
    out.metallicMap = textures.add(mtl.maps.metallic);
    if (out.roughnessMap !== null)
        out.roughness = 1;
    if (out.metallicMap !== null)
        out.metallic = 1;
    if (mtl.maps.normal) {
        out.normalMap = textures.add(mtl.maps.normal);
        out.normalScale = mtl.maps.normal.bumpMultiplier;
    }
    else if (mtl.maps.bump) {
        out.normalMap = textures.add(mtl.maps.bump);
        out.normalScale = mtl.maps.bump.bumpMultiplier;
        out.normalMapMayBeHeight = true;
    }
    if (mtl.maps.dissolve)
        warnings.push(`${mtl.name}: mapa de opacidade (map_d) ignorado; use o alfa da textura de cor base.`);
    if (mtl.maps.specular && mtl.metallic === null)
        warnings.push(`${mtl.name}: mapa especular (map_Ks) sem equivalente PBR foi ignorado.`);
    return out;
}
export async function importObj(file: File, bundle: FileBundle): Promise<ImportedScene> {
    const warnings: string[] = [];
    const doc = parseObj(await file.text());
    if (doc.parts.length === 0)
        throw new Error('O arquivo OBJ não contém faces.');
    if (doc.skippedPrimitives > 0)
        warnings.push(`${doc.skippedPrimitives} linha(s)/ponto(s) ignorados; apenas faces são importadas.`);
    const mtlMaterials = new Map<string, MtlMaterial>();
    for (const library of doc.materialLibraries) {
        const candidates = [library, ...library.split(/\s+/)];
        const resolved = candidates.map((candidate) => bundle.resolve(candidate, file.name)).find((candidate) => candidate !== null);
        if (!resolved) {
            warnings.push(`Biblioteca de materiais não encontrada: "${library}". Selecione o .mtl junto com o .obj.`);
            continue;
        }
        for (const [name, material] of parseMtl(await resolved.text()))
            mtlMaterials.set(name, material);
    }
    const textures = new TextureTable(bundle, file.name, warnings);
    const materials: ImportedMaterial[] = [];
    const materialIndexByName = new Map<string, number>();
    const materialIndexFor = (name: string | null): number | null => {
        if (name === null)
            return null;
        const existing = materialIndexByName.get(name);
        if (existing !== undefined)
            return existing;
        const mtl = mtlMaterials.get(name);
        const index = materials.length;
        if (mtl) {
            materials.push(convertMaterial(mtl, textures, warnings));
        }
        else {
            warnings.push(`Material "${name}" não está em nenhuma biblioteca; usando o padrão.`);
            materials.push(createImportedMaterial(name));
        }
        materialIndexByName.set(name, index);
        return index;
    };
    const fileName = baseNameWithoutExtension(file.name);
    const meshes: ImportedMesh[] = [];
    const nodesByObject = new Map<string, ImportedNode>();
    const roots: ImportedNode[] = [];
    const usedMeshNames = new Set<string>();
    for (const part of doc.parts) {
        const objectName = part.object || (doc.parts.some((candidate) => candidate.object) ? fileName : part.group || fileName);
        let node = nodesByObject.get(objectName);
        if (!node) {
            node = createImportedNode(objectName);
            nodesByObject.set(objectName, node);
            roots.push(node);
        }
        let meshName = part.group || part.object || part.material || fileName;
        if (usedMeshNames.has(meshName) && part.material)
            meshName = `${meshName}_${part.material}`;
        let suffix = 2;
        const baseMeshName = meshName;
        while (usedMeshNames.has(meshName))
            meshName = `${baseMeshName}_${suffix++}`;
        const mesh = buildPartMesh(meshName, part, doc, materialIndexFor(part.material));
        if (!mesh)
            continue;
        usedMeshNames.add(meshName);
        node.meshes.push(meshes.length);
        meshes.push(mesh);
    }
    if (meshes.length === 0)
        throw new Error('Nenhuma face válida encontrada no OBJ.');
    return {
        format: 'obj',
        name: fileName,
        sourceFile: file.name,
        roots,
        meshes,
        materials,
        textures: textures.textures,
        upAxis: 'y',
        skins: [],
        animations: [],
        metersPerUnit: null,
        warnings,
    };
}
