import * as vec3 from '@/engine/core/math/vec3';
import { ensureOutwardWinding, weldPositions, withSmoothNormals } from '../geometry-utils';
import { baseNameWithoutExtension, createImportedMaterial, createImportedNode, type ImportedScene } from '../import-types';
const BINARY_HEADER_BYTES = 80;
const BINARY_TRIANGLE_BYTES = 50;
function binaryTriangleCount(buffer: ArrayBuffer): number | null {
    if (buffer.byteLength < BINARY_HEADER_BYTES + 4)
        return null;
    const count = new DataView(buffer).getUint32(BINARY_HEADER_BYTES, true);
    return BINARY_HEADER_BYTES + 4 + count * BINARY_TRIANGLE_BYTES === buffer.byteLength ? count : null;
}
function pushFacet(soup: Float32Array, triangle: number, normal: ArrayLike<number>, vertices: ArrayLike<number>): void {
    const ax = vertices[0], ay = vertices[1], az = vertices[2];
    const bx = vertices[3], by = vertices[4], bz = vertices[5];
    const cx = vertices[6], cy = vertices[7], cz = vertices[8];
    const gx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const gy = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const gz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const flip = gx * normal[0] + gy * normal[1] + gz * normal[2] < 0;
    const base = triangle * 9;
    soup[base] = ax;
    soup[base + 1] = ay;
    soup[base + 2] = az;
    soup[base + 3] = flip ? cx : bx;
    soup[base + 4] = flip ? cy : by;
    soup[base + 5] = flip ? cz : bz;
    soup[base + 6] = flip ? bx : cx;
    soup[base + 7] = flip ? by : cy;
    soup[base + 8] = flip ? bz : cz;
}
function readBinary(buffer: ArrayBuffer, triangleCount: number): Float32Array {
    const view = new DataView(buffer);
    const soup = new Float32Array(triangleCount * 9);
    const normal = new Float32Array(3);
    const vertices = new Float32Array(9);
    let offset = BINARY_HEADER_BYTES + 4;
    for (let t = 0; t < triangleCount; t++) {
        for (let i = 0; i < 3; i++)
            normal[i] = view.getFloat32(offset + i * 4, true);
        for (let i = 0; i < 9; i++)
            vertices[i] = view.getFloat32(offset + 12 + i * 4, true);
        pushFacet(soup, t, normal, vertices);
        offset += BINARY_TRIANGLE_BYTES;
    }
    return soup;
}
const ASCII_FACET_PATTERN = /facet\s+normal\s+(\S+)\s+(\S+)\s+(\S+)\s+outer\s+loop\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
function readAscii(text: string): {
    soup: Float32Array;
    name: string;
} {
    const nameMatch = /^\s*solid\s+(.*)$/m.exec(text);
    const facets = Array.from(text.matchAll(ASCII_FACET_PATTERN));
    const soup = new Float32Array(facets.length * 9);
    const normal = new Float32Array(3);
    const vertices = new Float32Array(9);
    facets.forEach((match, t) => {
        for (let i = 0; i < 3; i++)
            normal[i] = Number(match[1 + i]) || 0;
        for (let i = 0; i < 9; i++)
            vertices[i] = Number(match[4 + i]) || 0;
        pushFacet(soup, t, normal, vertices);
    });
    return { soup, name: nameMatch?.[1]?.trim() ?? '' };
}
export async function importStl(file: File): Promise<ImportedScene> {
    const buffer = await file.arrayBuffer();
    const warnings: string[] = [];
    const fileName = baseNameWithoutExtension(file.name);
    let soup: Float32Array;
    let name = fileName;
    const binaryCount = binaryTriangleCount(buffer);
    if (binaryCount !== null) {
        soup = readBinary(buffer, binaryCount);
    }
    else {
        const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 512)));
        if (/^\s*solid/i.test(head) && !/facet|vertex/i.test(head) && buffer.byteLength > 512) {
            const guessed = Math.floor((buffer.byteLength - BINARY_HEADER_BYTES - 4) / BINARY_TRIANGLE_BYTES);
            soup = guessed > 0 ? readBinary(buffer, guessed) : new Float32Array(0);
            warnings.push('Tamanho do STL binário inconsistente com o cabeçalho; lidos todos os triângulos disponíveis.');
        }
        else {
            const ascii = readAscii(new TextDecoder().decode(buffer));
            soup = ascii.soup;
            if (ascii.name)
                name = ascii.name;
        }
    }
    if (soup.length < 9)
        throw new Error('O arquivo STL não contém triângulos.');
    const welded = weldPositions(soup);
    if (ensureOutwardWinding(welded.positions, welded.indices))
        warnings.push('Faces apontavam para dentro (volume negativo) e foram invertidas.');
    const geometry = withSmoothNormals(name, welded.positions, null, welded.indices);
    const node = createImportedNode(name);
    node.meshes.push(0);
    return {
        format: 'stl',
        name,
        sourceFile: file.name,
        roots: [node],
        meshes: [{ name, geometry, material: 0, hadNormals: false, hadUvs: false }],
        materials: [createImportedMaterial(`${name}_Material`, { baseColor: vec3.create(0.75, 0.75, 0.78), roughness: 0.5 })],
        textures: [],
        upAxis: 'z',
        metersPerUnit: null,
        warnings,
    };
}
