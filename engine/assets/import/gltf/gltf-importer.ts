import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Mat4 } from '@/engine/core/math/mat4';
import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { TextureFilter, TextureWrap } from '@/engine/core/scene/texture';
import { mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import { dataUriToBlob, isDataUri, type FileBundle } from '../file-bundle';
import { stripOrFanToTriangles, withFlatNormals } from '../geometry-utils';
import { baseNameWithoutExtension, createImportedMaterial, createImportedNode, createImportedTexture, type ImportedMaterial, type ImportedMesh, type ImportedNode, type ImportedScene, type ImportedTexture, } from '../import-types';
import type { GltfAccessor, GltfDocument, GltfMaterial, GltfNode, GltfPrimitive, GltfTextureInfo } from './gltf-types';
const GLB_MAGIC = 0x46546c67;
const GLB_CHUNK_JSON = 0x4e4f534a;
const GLB_CHUNK_BIN = 0x004e4942;
const COMPONENT_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const MODE_TRIANGLES = 4;
const MODE_TRIANGLE_STRIP = 5;
const MODE_TRIANGLE_FAN = 6;
const UNSUPPORTED_REQUIRED_EXTENSIONS = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'];
export function isGlb(buffer: ArrayBuffer): boolean {
    return buffer.byteLength >= 12 && new DataView(buffer).getUint32(0, true) === GLB_MAGIC;
}
function parseGlb(buffer: ArrayBuffer): {
    json: GltfDocument;
    binary: ArrayBuffer | null;
} {
    const view = new DataView(buffer);
    const version = view.getUint32(4, true);
    if (version !== 2)
        throw new Error(`GLB versão ${version} não suportada (apenas a versão 2).`);
    const length = Math.min(view.getUint32(8, true), buffer.byteLength);
    let offset = 12;
    let json: GltfDocument | null = null;
    let binary: ArrayBuffer | null = null;
    while (offset + 8 <= length) {
        const chunkLength = view.getUint32(offset, true);
        const chunkType = view.getUint32(offset + 4, true);
        const start = offset + 8;
        const end = Math.min(start + chunkLength, length);
        if (chunkType === GLB_CHUNK_JSON)
            json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, end - start))) as GltfDocument;
        else if (chunkType === GLB_CHUNK_BIN && !binary)
            binary = buffer.slice(start, end);
        offset = start + chunkLength;
    }
    if (!json)
        throw new Error('GLB sem bloco JSON.');
    return { json, binary };
}
function readComponent(view: DataView, offset: number, componentType: number, normalized: boolean): number {
    switch (componentType) {
        case 5120: {
            const value = view.getInt8(offset);
            return normalized ? Math.max(value / 127, -1) : value;
        }
        case 5121: {
            const value = view.getUint8(offset);
            return normalized ? value / 255 : value;
        }
        case 5122: {
            const value = view.getInt16(offset, true);
            return normalized ? Math.max(value / 32767, -1) : value;
        }
        case 5123: {
            const value = view.getUint16(offset, true);
            return normalized ? value / 65535 : value;
        }
        case 5125:
            return view.getUint32(offset, true);
        case 5126:
            return view.getFloat32(offset, true);
        default:
            throw new Error(`componentType ${componentType} desconhecido.`);
    }
}
class GltfReader {
    constructor(private readonly doc: GltfDocument, private readonly buffers: ArrayBuffer[]) { }
    readAccessor(index: number): {
        data: Float32Array;
        components: number;
        count: number;
    } {
        const accessor = this.doc.accessors?.[index];
        if (!accessor)
            throw new Error(`Accessor ${index} inexistente.`);
        const components = COMPONENT_COUNT[accessor.type];
        if (!components)
            throw new Error(`Tipo de accessor ${accessor.type} desconhecido.`);
        const data = new Float32Array(accessor.count * components);
        if (accessor.bufferView !== undefined) {
            this.fill(data, accessor.bufferView, accessor.byteOffset ?? 0, accessor.componentType, accessor.normalized ?? false, accessor.count, components);
        }
        if (accessor.sparse)
            this.applySparse(data, accessor, components);
        return { data, components, count: accessor.count };
    }
    readIndices(index: number): Uint32Array {
        return Uint32Array.from(this.readAccessor(index).data);
    }
    bufferViewBytes(index: number): Uint8Array {
        const view = this.doc.bufferViews?.[index];
        if (!view)
            throw new Error(`bufferView ${index} inexistente.`);
        const buffer = this.buffers[view.buffer];
        if (!buffer)
            throw new Error(`Buffer ${view.buffer} não carregado.`);
        return new Uint8Array(buffer, view.byteOffset ?? 0, view.byteLength);
    }
    private fill(out: Float32Array, viewIndex: number, accessorOffset: number, componentType: number, normalized: boolean, count: number, components: number): void {
        const view = this.doc.bufferViews?.[viewIndex];
        if (!view)
            throw new Error(`bufferView ${viewIndex} inexistente.`);
        const buffer = this.buffers[view.buffer];
        if (!buffer)
            throw new Error(`Buffer ${view.buffer} não carregado.`);
        const componentBytes = COMPONENT_BYTES[componentType];
        if (!componentBytes)
            throw new Error(`componentType ${componentType} desconhecido.`);
        const tight = componentBytes * components;
        const stride = view.byteStride || tight;
        const base = (view.byteOffset ?? 0) + accessorOffset;
        if (base + (count - 1) * stride + tight > buffer.byteLength)
            throw new Error('Accessor aponta para fora do buffer.');
        if (componentType === 5126 && !normalized && stride === tight && base % 4 === 0) {
            out.set(new Float32Array(buffer, base, count * components));
            return;
        }
        const dataView = new DataView(buffer);
        for (let i = 0; i < count; i++) {
            const elementOffset = base + i * stride;
            for (let c = 0; c < components; c++) {
                out[i * components + c] = readComponent(dataView, elementOffset + c * componentBytes, componentType, normalized);
            }
        }
    }
    private applySparse(out: Float32Array, accessor: GltfAccessor, components: number): void {
        const sparse = accessor.sparse;
        if (!sparse)
            return;
        const targets = new Float32Array(sparse.count);
        this.fill(targets, sparse.indices.bufferView, sparse.indices.byteOffset ?? 0, sparse.indices.componentType, false, sparse.count, 1);
        const values = new Float32Array(sparse.count * components);
        this.fill(values, sparse.values.bufferView, sparse.values.byteOffset ?? 0, accessor.componentType, accessor.normalized ?? false, sparse.count, components);
        for (let i = 0; i < sparse.count; i++) {
            out.set(values.subarray(i * components, (i + 1) * components), targets[i] * components);
        }
    }
}
async function loadBuffers(doc: GltfDocument, binary: ArrayBuffer | null, bundle: FileBundle, sourcePath: string): Promise<ArrayBuffer[]> {
    return Promise.all((doc.buffers ?? []).map(async (buffer, index) => {
        if (buffer.uri === undefined) {
            if (binary && index === 0)
                return binary;
            throw new Error(`Buffer ${index} sem URI e sem bloco binário.`);
        }
        if (isDataUri(buffer.uri))
            return (await dataUriToBlob(buffer.uri)).arrayBuffer();
        const file = bundle.resolve(buffer.uri, sourcePath);
        if (!file)
            throw new Error(`Buffer externo não encontrado: "${buffer.uri}". Selecione o .bin junto com o .gltf.`);
        return file.arrayBuffer();
    }));
}
function wrapMode(value: number | undefined): TextureWrap {
    if (value === 33071)
        return 'clamp';
    if (value === 33648)
        return 'mirror';
    return 'repeat';
}
function filterMode(value: number | undefined): TextureFilter {
    return value === 9728 || value === 9984 || value === 9986 ? 'nearest' : 'linear';
}
async function loadTextures(doc: GltfDocument, reader: GltfReader, bundle: FileBundle, sourcePath: string, warnings: string[]): Promise<ImportedTexture[]> {
    const imageBlobs = new Map<number, Promise<{
        blob: Blob | null;
        mimeType: string | null;
        path: string;
    }>>();
    const loadImage = (imageIndex: number) => {
        let pending = imageBlobs.get(imageIndex);
        if (pending)
            return pending;
        pending = (async () => {
            const image = doc.images?.[imageIndex];
            if (!image)
                return { blob: null, mimeType: null, path: `imagem_${imageIndex}` };
            if (image.bufferView !== undefined) {
                const bytes = reader.bufferViewBytes(image.bufferView);
                return { blob: new Blob([bytes], { type: image.mimeType ?? '' }), mimeType: image.mimeType ?? null, path: image.name || `imagem_${imageIndex}` };
            }
            if (image.uri) {
                if (isDataUri(image.uri)) {
                    const blob = await dataUriToBlob(image.uri);
                    return { blob, mimeType: image.mimeType ?? blob.type ?? null, path: image.name || `imagem_${imageIndex}` };
                }
                const file = bundle.resolve(image.uri, sourcePath);
                if (!file)
                    warnings.push(`Textura não encontrada: "${image.uri}". Selecione-a junto com o modelo.`);
                return { blob: file, mimeType: image.mimeType ?? file?.type ?? mimeTypeFromFileName(image.uri), path: image.uri };
            }
            return { blob: null, mimeType: null, path: image.name || `imagem_${imageIndex}` };
        })();
        imageBlobs.set(imageIndex, pending);
        return pending;
    };
    return Promise.all((doc.textures ?? []).map(async (texture, index) => {
        const webp = texture.extensions?.EXT_texture_webp?.source;
        const basisu = texture.extensions?.KHR_texture_basisu?.source;
        const sourceIndex = texture.source ?? webp;
        const sampler = texture.sampler !== undefined ? doc.samplers?.[texture.sampler] : undefined;
        const samplerOptions = { wrapS: wrapMode(sampler?.wrapS), wrapT: wrapMode(sampler?.wrapT), magFilter: filterMode(sampler?.magFilter), minFilter: filterMode(sampler?.minFilter) };
        if (sourceIndex === undefined) {
            if (basisu !== undefined)
                warnings.push(`Textura ${index} usa KTX2/Basis Universal, que não é suportado.`);
            return createImportedTexture(texture.name || `Textura_${index + 1}`, '', null, null, samplerOptions);
        }
        const { blob, mimeType, path } = await loadImage(sourceIndex);
        const name = texture.name || doc.images?.[sourceIndex]?.name || baseNameWithoutExtension(path) || `Textura_${index + 1}`;
        return createImportedTexture(name, path, blob, mimeType, samplerOptions);
    }));
}
function textureIndex(info: GltfTextureInfo | undefined, materialName: string, warnings: string[]): number | null {
    if (!info)
        return null;
    if (info.texCoord && info.texCoord !== 0)
        warnings.push(`${materialName}: apenas TEXCOORD_0 é suportado; a textura usa TEXCOORD_${info.texCoord}.`);
    if (info.extensions?.KHR_texture_transform)
        warnings.push(`${materialName}: KHR_texture_transform ignorado (deslocamento/escala de UV).`);
    return info.index;
}
function convertMaterial(material: GltfMaterial, index: number, warnings: string[]): ImportedMaterial {
    const name = material.name || `Material_${index + 1}`;
    const out = createImportedMaterial(name);
    const pbr = material.pbrMetallicRoughness;
    const specGloss = material.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (pbr || !specGloss) {
        const base = pbr?.baseColorFactor ?? [1, 1, 1, 1];
        vec3.set(out.baseColor, base[0], base[1], base[2]);
        out.opacity = base[3] ?? 1;
        out.metallic = pbr?.metallicFactor ?? 1;
        out.roughness = pbr?.roughnessFactor ?? 1;
        out.baseColorMap = textureIndex(pbr?.baseColorTexture, name, warnings);
        out.metallicRoughnessMap = textureIndex(pbr?.metallicRoughnessTexture, name, warnings);
    }
    else {
        const diffuse = specGloss.diffuseFactor ?? [1, 1, 1, 1];
        vec3.set(out.baseColor, diffuse[0], diffuse[1], diffuse[2]);
        out.opacity = diffuse[3] ?? 1;
        out.metallic = 0;
        out.roughness = 1 - (specGloss.glossinessFactor ?? 1);
        out.baseColorMap = textureIndex(specGloss.diffuseTexture, name, warnings);
        warnings.push(`${name}: material especular/brilho convertido para metálico/rugoso (aproximação).`);
    }
    out.normalMap = textureIndex(material.normalTexture, name, warnings);
    out.normalScale = material.normalTexture?.scale ?? 1;
    out.occlusionMap = textureIndex(material.occlusionTexture, name, warnings);
    out.occlusionStrength = material.occlusionTexture?.strength ?? 1;
    out.emissiveMap = textureIndex(material.emissiveTexture, name, warnings);
    const emissive = material.emissiveFactor ?? [0, 0, 0];
    vec3.set(out.emissive, emissive[0], emissive[1], emissive[2]);
    out.emissiveIntensity = material.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    out.alphaMode = material.alphaMode === 'MASK' ? 'mask' : material.alphaMode === 'BLEND' ? 'blend' : 'opaque';
    out.alphaCutoff = material.alphaCutoff ?? 0.5;
    out.doubleSided = material.doubleSided ?? false;
    if (material.extensions?.KHR_materials_unlit) {
        out.roughness = 1;
        out.metallic = 0;
        warnings.push(`${name}: material sem iluminação (unlit) renderizado como fosco.`);
    }
    return out;
}
const SLOT_SUFFIX: ReadonlyArray<[
    keyof ImportedMaterial,
    string
]> = [
    ['baseColorMap', 'CorBase'],
    ['metallicRoughnessMap', 'MetalicoRugosidade'],
    ['normalMap', 'Normal'],
    ['occlusionMap', 'Oclusao'],
    ['emissiveMap', 'Emissivo'],
];
function nameAnonymousTextures(textures: ImportedTexture[], materials: ImportedMaterial[]): void {
    const anonymous = /^(imagem|Textura)_\d+$/;
    for (const material of materials) {
        for (const [slot, suffix] of SLOT_SUFFIX) {
            const index = material[slot];
            if (typeof index !== 'number')
                continue;
            const texture = textures[index];
            if (texture && anonymous.test(texture.name))
                texture.name = `${material.name}_${suffix}`;
        }
    }
}
function convertPrimitive(reader: GltfReader, primitive: GltfPrimitive, name: string, warnings: string[]): ImportedMesh | null {
    const mode = primitive.mode ?? MODE_TRIANGLES;
    if (mode < MODE_TRIANGLES) {
        warnings.push(`${name}: primitiva de pontos ou linhas ignorada.`);
        return null;
    }
    if (primitive.extensions?.KHR_draco_mesh_compression) {
        warnings.push(`${name}: compressão Draco não suportada; primitiva ignorada.`);
        return null;
    }
    const positionAccessor = primitive.attributes.POSITION;
    if (positionAccessor === undefined) {
        warnings.push(`${name}: primitiva sem POSITION ignorada.`);
        return null;
    }
    const positions = reader.readAccessor(positionAccessor).data;
    const vertexCount = positions.length / 3;
    let indices: Uint32Array;
    if (primitive.indices !== undefined) {
        indices = reader.readIndices(primitive.indices);
    }
    else {
        indices = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++)
            indices[i] = i;
    }
    if (mode === MODE_TRIANGLE_STRIP)
        indices = stripOrFanToTriangles(indices, 'strip');
    else if (mode === MODE_TRIANGLE_FAN)
        indices = stripOrFanToTriangles(indices, 'fan');
    for (let i = 0; i < indices.length; i++) {
        if (indices[i] >= vertexCount)
            throw new Error(`${name}: índice ${indices[i]} fora do intervalo de vértices.`);
    }
    let uvs: Float32Array | null = null;
    const uvAccessor = primitive.attributes.TEXCOORD_0;
    if (uvAccessor !== undefined) {
        const read = reader.readAccessor(uvAccessor);
        if (read.components === 2 && read.count === vertexCount)
            uvs = read.data;
        else
            warnings.push(`${name}: TEXCOORD_0 com formato inesperado foi ignorado.`);
    }
    let geometry: MeshData;
    const normalAccessor = primitive.attributes.NORMAL;
    const hadNormals = normalAccessor !== undefined;
    if (normalAccessor !== undefined) {
        const normals = reader.readAccessor(normalAccessor).data;
        if (normals.length !== positions.length)
            throw new Error(`${name}: NORMAL e POSITION com contagens diferentes.`);
        geometry = { name, positions, normals, uvs: uvs ?? new Float32Array(vertexCount * 2), indices: createIndexArray(indices, vertexCount) };
    }
    else {
        geometry = withFlatNormals(name, positions, uvs, indices);
    }
    return { name, geometry, material: primitive.material ?? null, hadNormals, hadUvs: uvs !== null };
}
const nodeMatrix: Mat4 = mat4.create();
function matrixFromTrs(out: Mat4, translation: number[], rotation: number[], scale: number[]): Mat4 {
    const [x, y, z, w] = rotation;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    out[0] = (1 - 2 * (yy + zz)) * scale[0];
    out[1] = 2 * (xy + wz) * scale[0];
    out[2] = 2 * (xz - wy) * scale[0];
    out[3] = 0;
    out[4] = 2 * (xy - wz) * scale[1];
    out[5] = (1 - 2 * (xx + zz)) * scale[1];
    out[6] = 2 * (yz + wx) * scale[1];
    out[7] = 0;
    out[8] = 2 * (xz + wy) * scale[2];
    out[9] = 2 * (yz - wx) * scale[2];
    out[10] = (1 - 2 * (xx + yy)) * scale[2];
    out[11] = 0;
    out[12] = translation[0];
    out[13] = translation[1];
    out[14] = translation[2];
    out[15] = 1;
    return out;
}
function applyNodeTransform(node: GltfNode, out: ImportedNode): void {
    if (node.matrix && node.matrix.length === 16) {
        for (let i = 0; i < 16; i++)
            nodeMatrix[i] = node.matrix[i];
    }
    else {
        matrixFromTrs(nodeMatrix, node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1]);
    }
    mat4.decomposeTranslationRotationScale(out.position, out.rotation, out.scale, nodeMatrix);
}
export async function importGltf(file: File, bundle: FileBundle): Promise<ImportedScene> {
    const buffer = await file.arrayBuffer();
    const glb = isGlb(buffer);
    const { json: doc, binary } = glb ? parseGlb(buffer) : { json: JSON.parse(new TextDecoder().decode(buffer)) as GltfDocument, binary: null };
    if (!doc.asset?.version?.startsWith('2'))
        throw new Error(`glTF versão ${doc.asset?.version ?? 'desconhecida'} não suportada (apenas 2.x).`);
    const warnings: string[] = [];
    for (const extension of doc.extensionsRequired ?? []) {
        if (UNSUPPORTED_REQUIRED_EXTENSIONS.includes(extension))
            warnings.push(`Extensão obrigatória não suportada: ${extension}. Partes do modelo podem faltar.`);
    }
    const buffers = await loadBuffers(doc, binary, bundle, file.name);
    const reader = new GltfReader(doc, buffers);
    const textures = await loadTextures(doc, reader, bundle, file.name, warnings);
    const materials = (doc.materials ?? []).map((material, index) => convertMaterial(material, index, warnings));
    nameAnonymousTextures(textures, materials);
    const meshes: ImportedMesh[] = [];
    const meshLookup = new Map<number, number[]>();
    const meshIndicesFor = (meshIndex: number): number[] => {
        const cached = meshLookup.get(meshIndex);
        if (cached)
            return cached;
        const definition = doc.meshes?.[meshIndex];
        const indices: number[] = [];
        if (definition) {
            const baseName = definition.name || `Malha_${meshIndex + 1}`;
            definition.primitives.forEach((primitive, primitiveIndex) => {
                const name = definition.primitives.length > 1 ? `${baseName}_${primitiveIndex + 1}` : baseName;
                const converted = convertPrimitive(reader, primitive, name, warnings);
                if (!converted)
                    return;
                indices.push(meshes.length);
                meshes.push(converted);
            });
        }
        meshLookup.set(meshIndex, indices);
        return indices;
    };
    const sceneDefinition = doc.scenes?.[doc.scene ?? 0];
    const sceneName = sceneDefinition?.name || baseNameWithoutExtension(file.name);
    const visiting = new Set<number>();
    const convertNode = (index: number, fallbackName: string): ImportedNode | null => {
        const node = doc.nodes?.[index];
        if (!node || visiting.has(index))
            return null;
        visiting.add(index);
        const meshName = node.mesh !== undefined ? doc.meshes?.[node.mesh]?.name : undefined;
        const out = createImportedNode(node.name || meshName || fallbackName);
        applyNodeTransform(node, out);
        if (node.mesh !== undefined)
            out.meshes = meshIndicesFor(node.mesh);
        for (const child of node.children ?? []) {
            const converted = convertNode(child, `Nó_${child + 1}`);
            if (converted)
                out.children.push(converted);
        }
        visiting.delete(index);
        return out;
    };
    let rootIndices = sceneDefinition?.nodes;
    if (!rootIndices) {
        const referenced = new Set<number>();
        doc.nodes?.forEach((node) => node.children?.forEach((child) => referenced.add(child)));
        rootIndices = (doc.nodes ?? []).map((_, index) => index).filter((index) => !referenced.has(index));
    }
    const roots = rootIndices
        .map((index, position) => convertNode(index, rootIndices.length > 1 ? `${sceneName}_${position + 1}` : sceneName))
        .filter((node): node is ImportedNode => node !== null);
    if (roots.length === 0 && meshes.length === 0)
        throw new Error('O arquivo não contém malhas nem nós.');
    return {
        format: glb ? 'glb' : 'gltf',
        name: sceneName,
        sourceFile: file.name,
        roots,
        meshes,
        materials,
        textures,
        upAxis: 'y',
        metersPerUnit: 1,
        warnings,
    };
}
