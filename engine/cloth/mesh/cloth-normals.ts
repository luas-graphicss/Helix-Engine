const MIN_SQUARED_LENGTH = 1e-24;
export function computeParticleNormals(out: Float32Array, positions: Float32Array, triangles: Uint32Array): void {
    out.fill(0);
    for (let corner = 0; corner < triangles.length; corner += 3) {
        const a = triangles[corner] * 3;
        const b = triangles[corner + 1] * 3;
        const c = triangles[corner + 2] * 3;
        const abx = positions[b] - positions[a];
        const aby = positions[b + 1] - positions[a + 1];
        const abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a];
        const acy = positions[c + 1] - positions[a + 1];
        const acz = positions[c + 2] - positions[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        for (const particle of [a, b, c]) {
            out[particle] += nx;
            out[particle + 1] += ny;
            out[particle + 2] += nz;
        }
    }
    for (let offset = 0; offset < out.length; offset += 3) {
        const squaredLength = out[offset] ** 2 + out[offset + 1] ** 2 + out[offset + 2] ** 2;
        if (squaredLength < MIN_SQUARED_LENGTH) {
            out[offset] = 0;
            out[offset + 1] = 1;
            out[offset + 2] = 0;
            continue;
        }
        const scale = 1 / Math.sqrt(squaredLength);
        out[offset] *= scale;
        out[offset + 1] *= scale;
        out[offset + 2] *= scale;
    }
}
