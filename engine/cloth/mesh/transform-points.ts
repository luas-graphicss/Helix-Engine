import type { Mat4 } from '@/engine/core/math/mat4';
export function transformPoints(out: Float32Array, matrix: Mat4, points: Float32Array): void {
    for (let offset = 0; offset < points.length; offset += 3) {
        const x = points[offset];
        const y = points[offset + 1];
        const z = points[offset + 2];
        out[offset] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        out[offset + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        out[offset + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    }
}
