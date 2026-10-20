import type { GL } from './context';
import type { InstanceLayout } from './instance-layout';
const INITIAL_CAPACITY = 256;
export class InstanceBuffer {
    readonly buffer: WebGLBuffer;
    data: Float32Array;
    count = 0;
    constructor(private readonly gl: GL, readonly layout: InstanceLayout) {
        const buffer = gl.createBuffer();
        if (!buffer)
            throw new Error('Não foi possível criar o buffer de instâncias.');
        this.buffer = buffer;
        this.data = new Float32Array(INITIAL_CAPACITY * layout.floatsPerInstance);
    }
    begin(): void {
        this.count = 0;
    }
    allocate(amount: number): number {
        const first = this.count;
        const required = (first + amount) * this.layout.floatsPerInstance;
        if (required > this.data.length)
            this.grow(required);
        this.count += amount;
        return first;
    }
    upload(): void {
        if (this.count === 0)
            return;
        const { gl } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.count * this.layout.floatsPerInstance), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    private grow(requiredFloats: number): void {
        let length = this.data.length;
        while (length < requiredFloats)
            length *= 2;
        const grown = new Float32Array(length);
        grown.set(this.data);
        this.data = grown;
    }
    dispose(): void {
        this.gl.deleteBuffer(this.buffer);
    }
}
