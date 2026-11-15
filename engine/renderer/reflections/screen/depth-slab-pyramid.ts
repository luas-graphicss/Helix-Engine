import type { GL } from '@/engine/renderer/gl/context';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { DEPTH_SLAB_BASE_FRAGMENT_SHADER, DEPTH_SLAB_REDUCE_FRAGMENT_SHADER } from '../shaders/depth-slab.glsl';
import type { SurfaceBuffer } from './surface-buffer';
const DEPTH_UNIT = 0;
const SURFACE_UNIT = 1;
const SOURCE_UNIT = 0;
const MAX_LEVELS = 8;
export interface DepthSlabInput {
    camera: PerspectiveCamera;
    depth: WebGLTexture;
    surface: SurfaceBuffer;
    width: number;
    height: number;
}
export class DepthSlabPyramid {
    readonly stats = { drawCalls: 0 };
    texture!: WebGLTexture;
    levels = 0;
    private width = 0;
    private height = 0;
    private framebuffers: WebGLFramebuffer[] = [];
    private readonly baseProgram: ShaderProgram;
    private readonly reduceProgram: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.baseProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, DEPTH_SLAB_BASE_FRAGMENT_SHADER);
        this.reduceProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, DEPTH_SLAB_REDUCE_FRAGMENT_SHADER);
        this.allocate(1, 1);
    }
    get maxLevel(): number {
        return this.levels - 1;
    }
    build(input: DepthSlabInput): void {
        const { gl } = this;
        if (input.width !== this.width || input.height !== this.height) {
            this.release();
            this.allocate(input.width, input.height);
        }
        gl.disable(gl.DEPTH_TEST);
        this.renderBase(input);
        this.renderReductions();
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.stats.drawCalls = this.levels;
    }
    dispose(): void {
        this.release();
        this.baseProgram.dispose();
        this.reduceProgram.dispose();
    }
    private renderBase({ camera, depth, surface }: DepthSlabInput): void {
        const { gl, baseProgram: program } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[0]);
        gl.viewport(0, 0, this.width, this.height);
        program.use();
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.uniform1i(program.uniform('u_sceneDepth'), DEPTH_UNIT);
        gl.activeTexture(gl.TEXTURE0 + SURFACE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, surface.texture);
        gl.uniform1i(program.uniform('u_surface'), SURFACE_UNIT);
        gl.uniformMatrix4fv(program.uniform('u_view'), false, camera.viewMatrix);
        gl.uniformMatrix4fv(program.uniform('u_projection'), false, camera.projectionMatrix);
        gl.uniform2f(program.uniform('u_sceneSize'), this.width, this.height);
        this.triangle.draw();
    }
    private renderReductions(): void {
        const { gl, reduceProgram: program, triangle } = this;
        program.use();
        gl.activeTexture(gl.TEXTURE0 + SOURCE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(program.uniform('u_slabs'), SOURCE_UNIT);
        for (let level = 1; level < this.levels; level++) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, level - 1);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, level - 1);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[level]);
            gl.viewport(0, 0, Math.max(1, this.width >> level), Math.max(1, this.height >> level));
            triangle.draw();
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this.levels - 1);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    private release(): void {
        const { gl } = this;
        for (const framebuffer of this.framebuffers)
            gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(this.texture);
        this.framebuffers = [];
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar a pirâmide de profundidade dos reflexos.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.levels = Math.min(MAX_LEVELS, Math.floor(Math.log2(Math.max(this.width, this.height))) + 1);
        this.texture = texture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, this.levels, gl.RG32F, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        for (let level = 0; level < this.levels; level++)
            this.framebuffers.push(this.createLevelFramebuffer(texture, level));
        const status = framebufferStatus(gl, 'depth-slab-pyramid');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Pirâmide de profundidade dos reflexos incompleta (0x${status.toString(16)}).`);
    }
    private createLevelFramebuffer(texture: WebGLTexture, level: number): WebGLFramebuffer {
        const { gl } = this;
        const framebuffer = gl.createFramebuffer();
        if (!framebuffer)
            throw new Error('Não foi possível alocar um nível da pirâmide de profundidade dos reflexos.');
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, level);
        return framebuffer;
    }
}
