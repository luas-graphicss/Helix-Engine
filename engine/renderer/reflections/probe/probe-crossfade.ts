import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { PROBE_CROSSFADE_FRAGMENT_SHADER } from '../shaders/probe-crossfade.glsl';
import { CUBE_FACE_COUNT, createProbeCubemap, type ProbeCubemapLayout } from './probe-cubemap';
export const CROSSFADE_FRAMES = CUBE_FACE_COUNT;
const OUTGOING_UNIT = 0;
const INCOMING_UNIT = 1;
export class ProbeCrossfade {
    readonly displayed: WebGLTexture;
    private readonly captures: readonly [
        WebGLTexture,
        WebGLTexture
    ];
    private readonly framebuffer: WebGLFramebuffer;
    private readonly program: ShaderProgram;
    private latest = 0;
    private frame = CROSSFADE_FRAMES;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly layout: ProbeCubemapLayout, defines: ShaderDefines) {
        this.displayed = createProbeCubemap(gl, layout);
        this.captures = [createProbeCubemap(gl, layout), createProbeCubemap(gl, layout)];
        const framebuffer = gl.createFramebuffer();
        if (!framebuffer)
            throw new Error('Não foi possível alocar a transição da sonda de reflexo.');
        this.framebuffer = framebuffer;
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(PROBE_CROSSFADE_FRAGMENT_SHADER, defines));
    }
    get incoming(): WebGLTexture {
        return this.captures[1 - this.latest];
    }
    get active(): boolean {
        return this.frame < CROSSFADE_FRAMES;
    }
    show(): number {
        this.latest = 1 - this.latest;
        this.frame = CROSSFADE_FRAMES;
        return this.blend(1);
    }
    fadeIn(): void {
        this.latest = 1 - this.latest;
        this.frame = 0;
    }
    advance(): number {
        if (!this.active)
            return 0;
        this.frame++;
        return this.blend(this.frame / CROSSFADE_FRAMES);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteTexture(this.displayed);
        gl.deleteTexture(this.captures[0]);
        gl.deleteTexture(this.captures[1]);
        gl.deleteFramebuffer(this.framebuffer);
        this.program.dispose();
    }
    private blend(incomingWeight: number): number {
        const { gl, program, triangle, layout } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.disable(gl.DEPTH_TEST);
        program.use();
        gl.activeTexture(gl.TEXTURE0 + OUTGOING_UNIT);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.captures[1 - this.latest]);
        gl.uniform1i(program.uniform('u_outgoing'), OUTGOING_UNIT);
        gl.activeTexture(gl.TEXTURE0 + INCOMING_UNIT);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.captures[this.latest]);
        gl.uniform1i(program.uniform('u_incoming'), INCOMING_UNIT);
        gl.uniform1f(program.uniform('u_weight'), incomingWeight);
        for (let level = 0; level < layout.levels; level++) {
            const levelSize = Math.max(1, layout.size >> level);
            gl.viewport(0, 0, levelSize, levelSize);
            gl.uniform1f(program.uniform('u_targetSize'), levelSize);
            gl.uniform1f(program.uniform('u_level'), level);
            for (let face = 0; face < CUBE_FACE_COUNT; face++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, this.displayed, level);
                gl.uniform1i(program.uniform('u_face'), face);
                triangle.draw();
            }
        }
        gl.enable(gl.DEPTH_TEST);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        gl.activeTexture(gl.TEXTURE0 + OUTGOING_UNIT);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return layout.levels * CUBE_FACE_COUNT;
    }
}
