import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { MYRIAD_CULL_FRAGMENT_SHADER } from '../shaders/myriad-cull.glsl';
import type { DepthPyramid } from './depth-pyramid';
import type { EntryList, InstanceTable } from './frame-data';
import type { GeometryPool } from './geometry-pool';
export interface CullPassInput {
    list: EntryList;
    instances: InstanceTable;
    pool: GeometryPool;
    pyramid: DepthPyramid;
    viewProjection: Float32Array;
    useHistory: boolean;
    postPass: boolean;
}
export class ClusterCullPass {
    readonly flags: [
        ColorRenderTarget,
        ColorRenderTarget
    ];
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, width: number, defines: ShaderDefines) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(MYRIAD_CULL_FRAGMENT_SHADER, defines));
        this.flags = [
            new ColorRenderTarget(gl, { width, height: 1, format: 'rgba8', filter: 'nearest' }),
            new ColorRenderTarget(gl, { width, height: 1, format: 'rgba8', filter: 'nearest' }),
        ];
    }
    run(input: CullPassInput, target: 0 | 1): void {
        const { gl, program } = this;
        const { list, pyramid } = input;
        const rows = list.rows;
        for (const flag of this.flags)
            flag.resize(list.width, rows);
        const output = this.flags[target];
        const previous = this.flags[target === 0 ? 1 : 0];
        output.bind();
        program.use();
        gl.disable(gl.DEPTH_TEST);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, list.texture.texture);
        gl.uniform1i(program.uniform('u_list'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, input.instances.texture.texture);
        gl.uniform1i(program.uniform('u_instances'), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, pyramid.texture);
        gl.uniform1i(program.uniform('u_hzb'), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, previous.texture);
        gl.uniform1i(program.uniform('u_previousFlags'), 3);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, input.pool.clusterBounds.texture);
        gl.uniform1i(program.uniform('u_clusterBounds'), 4);
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, input.viewProjection);
        gl.uniform1i(program.uniform('u_entryCount'), list.count);
        gl.uniform1i(program.uniform('u_useHistory'), input.useHistory ? 1 : 0);
        gl.uniform1i(program.uniform('u_postPass'), input.postPass ? 1 : 0);
        gl.uniform2f(program.uniform('u_hzbSize'), pyramid.width, pyramid.height);
        gl.uniform1i(program.uniform('u_hzbMaxLevel'), pyramid.levels - 1);
        this.triangle.draw();
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dispose(): void {
        this.program.dispose();
        for (const flag of this.flags)
            flag.dispose();
    }
}
