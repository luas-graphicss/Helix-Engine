import type { GL } from '@/engine/renderer/gl/context';
import { InstanceLayout } from '@/engine/renderer/gl/instance-layout';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { ATTRIB_PATCH, ATTRIB_TILE_ORIGIN, buildTerrainPatch, patchRangeIndex, type PatchRange } from './terrain-patch';
export const TERRAIN_TILE_INSTANCE_LAYOUT = new InstanceLayout([{ location: ATTRIB_TILE_ORIGIN, size: 2, offset: 0 }], 2);
const PATCH_COMPONENTS = 2;
const INDEX_BYTES = 2;
function createBuffer(gl: GL, target: number, data: ArrayBufferView): WebGLBuffer {
    const buffer = gl.createBuffer();
    if (!buffer)
        throw new Error('Não foi possível criar um buffer do patch de terreno.');
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
}
export class TerrainPatchGeometry {
    private readonly vao: WebGLVertexArrayObject;
    private readonly vertexBuffer: WebGLBuffer;
    private readonly indexBuffer: WebGLBuffer;
    private readonly ranges: readonly PatchRange[];
    constructor(private readonly gl: GL) {
        const patch = buildTerrainPatch();
        this.ranges = patch.ranges;
        const vao = gl.createVertexArray();
        if (!vao)
            throw new Error('Não foi possível criar o VAO do patch de terreno.');
        this.vao = vao;
        gl.bindVertexArray(vao);
        this.vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, patch.vertices);
        gl.enableVertexAttribArray(ATTRIB_PATCH);
        gl.vertexAttribPointer(ATTRIB_PATCH, PATCH_COMPONENTS, gl.FLOAT, false, 0, 0);
        this.indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, patch.indices);
        gl.bindVertexArray(null);
    }
    bind(): void {
        this.gl.bindVertexArray(this.vao);
    }
    draw(level: number, stitchMask: number, instances: InstanceBuffer, firstInstance: number, count: number): number {
        const { gl } = this;
        const range = this.ranges[patchRangeIndex(level, stitchMask)];
        TERRAIN_TILE_INSTANCE_LAYOUT.bind(gl, instances.buffer, firstInstance);
        gl.drawElementsInstanced(gl.TRIANGLES, range.count, gl.UNSIGNED_SHORT, range.first * INDEX_BYTES, count);
        return (range.count / 3) * count;
    }
    unbind(): void {
        this.gl.bindVertexArray(null);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteVertexArray(this.vao);
        gl.deleteBuffer(this.vertexBuffer);
        gl.deleteBuffer(this.indexBuffer);
    }
}
