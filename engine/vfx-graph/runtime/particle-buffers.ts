import type { GL } from '@/engine/renderer/gl/context';
import { ATTRIBUTE_BYTES, ATTRIBUTE_COMPONENTS, PARTICLE_ATTRIBUTE_COUNT, PARTICLE_STRIDE_BYTES } from './particle-layout';
const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const QUAD_VERTEX_COUNT = 4;
const CORNER_LOCATION = 0;
const FIRST_INSTANCE_LOCATION = 1;
function required<TResource>(resource: TResource | null): TResource {
    if (resource === null)
        throw new Error('Não foi possível alocar os buffers das partículas na GPU.');
    return resource;
}
export class ParticleBuffers {
    private readonly states: readonly [
        WebGLBuffer,
        WebGLBuffer
    ];
    private readonly simulationArrays: readonly [
        WebGLVertexArrayObject,
        WebGLVertexArrayObject
    ];
    private readonly drawArray: WebGLVertexArrayObject;
    private readonly corners: WebGLBuffer;
    private readonly feedback: WebGLTransformFeedback;
    private current = 0;
    constructor(private readonly gl: GL, readonly capacity: number) {
        this.states = [required(gl.createBuffer()), required(gl.createBuffer())];
        this.simulationArrays = [required(gl.createVertexArray()), required(gl.createVertexArray())];
        this.drawArray = required(gl.createVertexArray());
        this.corners = required(gl.createBuffer());
        this.feedback = required(gl.createTransformFeedback());
        this.clear();
        this.states.forEach((state, index) => this.describeSimulationArray(this.simulationArrays[index], state));
        this.describeDrawArray();
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    clear(): void {
        const { gl } = this;
        for (const state of this.states) {
            gl.bindBuffer(gl.ARRAY_BUFFER, state);
            gl.bufferData(gl.ARRAY_BUFFER, this.capacity * PARTICLE_STRIDE_BYTES, gl.DYNAMIC_COPY);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    step(): void {
        const { gl } = this;
        const target = 1 - this.current;
        gl.bindVertexArray(this.simulationArrays[this.current]);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.states[target]);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.capacity);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindVertexArray(null);
        this.current = target;
    }
    draw(first: number, count: number): void {
        const { gl } = this;
        const untilEnd = Math.min(count, this.capacity - first);
        gl.bindVertexArray(this.drawArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.states[this.current]);
        this.drawRange(first, untilEnd);
        if (count > untilEnd)
            this.drawRange(0, count - untilEnd);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    dispose(): void {
        const { gl } = this;
        for (const state of this.states)
            gl.deleteBuffer(state);
        for (const array of this.simulationArrays)
            gl.deleteVertexArray(array);
        gl.deleteVertexArray(this.drawArray);
        gl.deleteBuffer(this.corners);
        gl.deleteTransformFeedback(this.feedback);
    }
    private describeSimulationArray(array: WebGLVertexArrayObject, state: WebGLBuffer): void {
        const { gl } = this;
        gl.bindVertexArray(array);
        gl.bindBuffer(gl.ARRAY_BUFFER, state);
        for (let attribute = 0; attribute < PARTICLE_ATTRIBUTE_COUNT; attribute++) {
            gl.enableVertexAttribArray(attribute);
            gl.vertexAttribPointer(attribute, ATTRIBUTE_COMPONENTS, gl.FLOAT, false, PARTICLE_STRIDE_BYTES, attribute * ATTRIBUTE_BYTES);
        }
    }
    private describeDrawArray(): void {
        const { gl } = this;
        gl.bindVertexArray(this.drawArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.corners);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(CORNER_LOCATION);
        gl.vertexAttribPointer(CORNER_LOCATION, 2, gl.FLOAT, false, 0, 0);
        for (let attribute = 0; attribute < PARTICLE_ATTRIBUTE_COUNT; attribute++) {
            gl.enableVertexAttribArray(FIRST_INSTANCE_LOCATION + attribute);
            gl.vertexAttribDivisor(FIRST_INSTANCE_LOCATION + attribute, 1);
        }
    }
    private drawRange(first: number, count: number): void {
        const { gl } = this;
        if (count <= 0)
            return;
        const base = first * PARTICLE_STRIDE_BYTES;
        for (let attribute = 0; attribute < PARTICLE_ATTRIBUTE_COUNT; attribute++)
            gl.vertexAttribPointer(FIRST_INSTANCE_LOCATION + attribute, ATTRIBUTE_COMPONENTS, gl.FLOAT, false, PARTICLE_STRIDE_BYTES, base + attribute * ATTRIBUTE_BYTES);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, QUAD_VERTEX_COUNT, count);
    }
}
