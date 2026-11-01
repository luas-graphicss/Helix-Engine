import type { MeshData } from './mesh-data';
export const TANGENT_COMPONENTS = 4;
const DEGENERATE_UV_DETERMINANT = 1e-20;
const DEGENERATE_TANGENT = 1e-12;
export function computeTangents(positions: ArrayLike<number>, normals: ArrayLike<number>, uvs: ArrayLike<number>, indices: ArrayLike<number>): Float32Array {
    const vertexCount = positions.length / 3;
    const alongU = new Float32Array(vertexCount * 3);
    const alongV = new Float32Array(vertexCount * 3);
    for (let i = 0; i + 2 < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];
        const p0 = i0 * 3;
        const p1 = i1 * 3;
        const p2 = i2 * 3;
        const t0 = i0 * 2;
        const t1 = i1 * 2;
        const t2 = i2 * 2;
        const e1x = positions[p1] - positions[p0];
        const e1y = positions[p1 + 1] - positions[p0 + 1];
        const e1z = positions[p1 + 2] - positions[p0 + 2];
        const e2x = positions[p2] - positions[p0];
        const e2y = positions[p2 + 1] - positions[p0 + 1];
        const e2z = positions[p2 + 2] - positions[p0 + 2];
        const du1 = uvs[t1] - uvs[t0];
        const dv1 = uvs[t1 + 1] - uvs[t0 + 1];
        const du2 = uvs[t2] - uvs[t0];
        const dv2 = uvs[t2 + 1] - uvs[t0 + 1];
        const determinant = du1 * dv2 - du2 * dv1;
        if (Math.abs(determinant) < DEGENERATE_UV_DETERMINANT)
            continue;
        const r = 1 / determinant;
        const ux = (e1x * dv2 - e2x * dv1) * r;
        const uy = (e1y * dv2 - e2y * dv1) * r;
        const uz = (e1z * dv2 - e2z * dv1) * r;
        const vx = (e2x * du1 - e1x * du2) * r;
        const vy = (e2y * du1 - e1y * du2) * r;
        const vz = (e2z * du1 - e1z * du2) * r;
        accumulate(alongU, p0, ux, uy, uz);
        accumulate(alongU, p1, ux, uy, uz);
        accumulate(alongU, p2, ux, uy, uz);
        accumulate(alongV, p0, vx, vy, vz);
        accumulate(alongV, p1, vx, vy, vz);
        accumulate(alongV, p2, vx, vy, vz);
    }
    const tangents = new Float32Array(vertexCount * TANGENT_COMPONENTS);
    for (let v = 0; v < vertexCount; v++) {
        const p = v * 3;
        const o = v * TANGENT_COMPONENTS;
        const nx = normals[p];
        const ny = normals[p + 1];
        const nz = normals[p + 2];
        const dotNT = nx * alongU[p] + ny * alongU[p + 1] + nz * alongU[p + 2];
        let tx = alongU[p] - nx * dotNT;
        let ty = alongU[p + 1] - ny * dotNT;
        let tz = alongU[p + 2] - nz * dotNT;
        const length2 = tx * tx + ty * ty + tz * tz;
        if (length2 < DEGENERATE_TANGENT) {
            writePerpendicular(tangents, o, nx, ny, nz);
            continue;
        }
        const inverseLength = 1 / Math.sqrt(length2);
        tx *= inverseLength;
        ty *= inverseLength;
        tz *= inverseLength;
        const bx = ny * tz - nz * ty;
        const by = nz * tx - nx * tz;
        const bz = nx * ty - ny * tx;
        const mirrored = bx * alongV[p] + by * alongV[p + 1] + bz * alongV[p + 2] > 0;
        tangents[o] = tx;
        tangents[o + 1] = ty;
        tangents[o + 2] = tz;
        tangents[o + 3] = mirrored ? -1 : 1;
    }
    return tangents;
}
export function resolveTangents(mesh: MeshData): Float32Array {
    const expected = (mesh.positions.length / 3) * TANGENT_COMPONENTS;
    if (mesh.tangents && mesh.tangents.length === expected)
        return mesh.tangents;
    return computeTangents(mesh.positions, mesh.normals, mesh.uvs, mesh.indices);
}
function accumulate(target: Float32Array, offset: number, x: number, y: number, z: number): void {
    target[offset] += x;
    target[offset + 1] += y;
    target[offset + 2] += z;
}
function writePerpendicular(target: Float32Array, offset: number, nx: number, ny: number, nz: number): void {
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    let tx: number;
    let ty: number;
    let tz: number;
    if (ax <= ay && ax <= az) {
        tx = 0;
        ty = -nz;
        tz = ny;
    }
    else if (ay <= az) {
        tx = nz;
        ty = 0;
        tz = -nx;
    }
    else {
        tx = -ny;
        ty = nx;
        tz = 0;
    }
    const length = Math.sqrt(tx * tx + ty * ty + tz * tz);
    const inverseLength = length > 0 ? 1 / length : 0;
    target[offset] = length > 0 ? tx * inverseLength : 1;
    target[offset + 1] = ty * inverseLength;
    target[offset + 2] = tz * inverseLength;
    target[offset + 3] = 1;
}
