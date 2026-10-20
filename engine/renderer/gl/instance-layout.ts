import type { GL } from './context';
export interface InstanceAttribute {
    location: number;
    size: 1 | 2 | 3 | 4;
    offset: number;
}
const FLOAT_BYTES = 4;
export class InstanceLayout {
    readonly strideBytes: number;
    constructor(readonly attributes: readonly InstanceAttribute[], readonly floatsPerInstance: number) {
        this.strideBytes = floatsPerInstance * FLOAT_BYTES;
    }
    bind(gl: GL, buffer: WebGLBuffer, firstInstance: number): void {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        const base = firstInstance * this.strideBytes;
        for (const attribute of this.attributes) {
            gl.enableVertexAttribArray(attribute.location);
            gl.vertexAttribPointer(attribute.location, attribute.size, gl.FLOAT, false, this.strideBytes, base + attribute.offset * FLOAT_BYTES);
            gl.vertexAttribDivisor(attribute.location, 1);
        }
    }
}
export const MODEL_MATRIX_ATTRIBUTES: readonly InstanceAttribute[] = [
    { location: 3, size: 4, offset: 0 },
    { location: 4, size: 4, offset: 4 },
    { location: 5, size: 4, offset: 8 },
    { location: 6, size: 4, offset: 12 },
];
