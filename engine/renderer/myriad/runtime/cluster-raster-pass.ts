import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { CLUSTER_MAX_TRIANGLES } from '../data/myriad-limits';
import { MYRIAD_DEPTH_FRAGMENT_SHADER, MYRIAD_RASTER_FRAGMENT_SHADER, MYRIAD_RASTER_VERTEX_SHADER } from '../shaders/myriad-raster.glsl';
import type { EntryList } from './frame-data';
import type { GeometryPool } from './geometry-pool';
export const POST_PASS_BIT = 0x10000;
export interface RasterInput {
    list: EntryList;
    pool: GeometryPool;
    viewProjection: Float32Array;
    cullFlags: WebGLTexture | null;
    passBits: number;
}
const VERTICES_PER_CLUSTER = CLUSTER_MAX_TRIANGLES * 3;
export class ClusterRasterPass {
    private readonly visibility: ShaderProgram;
    private readonly depthOnly: ShaderProgram;
    constructor(private readonly gl: GL, defines: ShaderDefines) {
        this.visibility = new ShaderProgram(gl, withDefines(MYRIAD_RASTER_VERTEX_SHADER, defines), MYRIAD_RASTER_FRAGMENT_SHADER);
        this.depthOnly = new ShaderProgram(gl, withDefines(MYRIAD_RASTER_VERTEX_SHADER, { ...defines, DEPTH_ONLY: true }), MYRIAD_DEPTH_FRAGMENT_SHADER);
    }
    draw(input: RasterInput, depthOnly: boolean): number {
        const { gl } = this;
        const { list, pool } = input;
        if (list.count === 0)
            return 0;
        const program = depthOnly ? this.depthOnly : this.visibility;
        program.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pool.vertices.texture);
        gl.uniform1i(program.uniform('u_vertices'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, pool.triangles.texture);
        gl.uniform1i(program.uniform('u_triangles'), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, pool.clusterInfo.texture);
        gl.uniform1i(program.uniform('u_clusterInfo'), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, pool.clusterBounds.texture);
        gl.uniform1i(program.uniform('u_clusterBounds'), 3);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, input.cullFlags);
        gl.uniform1i(program.uniform('u_cullFlags'), 4);
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, input.viewProjection);
        gl.uniform1i(program.uniform('u_cullMode'), input.cullFlags ? 1 : 0);
        gl.uniform1ui(program.uniform('u_passBits'), input.passBits);
        let drawCalls = 0;
        const singleSided = list.doubleSidedStart;
        const doubleSided = list.count - list.doubleSidedStart;
        if (singleSided > 0) {
            list.bindRange(0);
            gl.uniform1i(program.uniform('u_slotBase'), 0);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTICES_PER_CLUSTER, singleSided);
            drawCalls++;
        }
        if (doubleSided > 0) {
            list.bindRange(list.doubleSidedStart);
            gl.uniform1i(program.uniform('u_slotBase'), list.doubleSidedStart);
            const culling = gl.isEnabled(gl.CULL_FACE);
            gl.disable(gl.CULL_FACE);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTICES_PER_CLUSTER, doubleSided);
            if (culling)
                gl.enable(gl.CULL_FACE);
            drawCalls++;
        }
        gl.bindVertexArray(null);
        return drawCalls;
    }
    dispose(): void {
        this.visibility.dispose();
        this.depthOnly.dispose();
    }
}
