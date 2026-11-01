import { getVertexCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
const OBJ_MIME_TYPE = 'model/obj';
const DECIMALS = 6;
function formatNumber(value: number): string {
    if (!Number.isFinite(value))
        return '0';
    const text = value.toFixed(DECIMALS).replace(/\.?0+$/, '');
    return text === '-0' || text === '' ? '0' : text;
}
function objectName(name: string): string {
    return name.trim().replace(/\s+/g, '_') || 'Malha';
}
function fileStem(name: string): string {
    return name.trim().replace(/[\\/]+/g, '-') || 'Malha';
}
export function meshDataToObj(mesh: MeshData, name: string): string {
    const vertexCount = getVertexCount(mesh);
    const { positions, normals, uvs, indices } = mesh;
    const hasUvs = uvs.length === vertexCount * 2;
    const hasNormals = normals.length === vertexCount * 3 && normals.some((component) => component !== 0);
    const lines: string[] = [`# Helix Engine — ${name.trim()}`, `o ${objectName(name)}`];
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        const offset = vertex * 3;
        lines.push(`v ${formatNumber(positions[offset])} ${formatNumber(positions[offset + 1])} ${formatNumber(positions[offset + 2])}`);
    }
    if (hasUvs) {
        for (let vertex = 0; vertex < vertexCount; vertex++)
            lines.push(`vt ${formatNumber(uvs[vertex * 2])} ${formatNumber(1 - uvs[vertex * 2 + 1])}`);
    }
    if (hasNormals) {
        for (let vertex = 0; vertex < vertexCount; vertex++) {
            const offset = vertex * 3;
            lines.push(`vn ${formatNumber(normals[offset])} ${formatNumber(normals[offset + 1])} ${formatNumber(normals[offset + 2])}`);
        }
    }
    const corner = (index: number): string => {
        const one = index + 1;
        if (hasUvs && hasNormals)
            return `${one}/${one}/${one}`;
        if (hasUvs)
            return `${one}/${one}`;
        if (hasNormals)
            return `${one}//${one}`;
        return String(one);
    };
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
        lines.push(`f ${corner(indices[triangle])} ${corner(indices[triangle + 1])} ${corner(indices[triangle + 2])}`);
    }
    return `${lines.join('\n')}\n`;
}
export function meshDataToObjFile(mesh: MeshData, name: string): File {
    return new File([meshDataToObj(mesh, name)], `${fileStem(name)}.obj`, { type: OBJ_MIME_TYPE });
}
