import * as mat4 from '@/engine/core/math/mat4';
import type { GL } from '@/engine/renderer/gl/context';
import { colorInternalFormat, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { SCREEN_REFLECTIONS_FRAGMENT_SHADER } from '../shaders/screen-reflections.glsl';
import type { DepthSlabPyramid } from './depth-slab-pyramid';
import type { SceneHistory } from './scene-history';
import type { SurfaceBuffer } from './surface-buffer';
const DEPTH_UNIT = 0;
const SURFACE_UNIT = 1;
const HISTORY_UNIT = 2;
const SLABS_UNIT = 3;
const MIRROR_UNIT = 4;
const MAX_RESULT_LEVELS = 5;
const DEPTH_BUFFER_ULP = 2 ** -24;
const DEPTH_NOISE_ULPS = 4;
export interface ScreenMirror {
    readonly color: WebGLTexture;
    readonly viewPlane: Float32Array;
}
export interface ScreenReflectionInput {
    camera: PerspectiveCamera;
    depth: WebGLTexture;
    surface: SurfaceBuffer;
    history: SceneHistory;
    slabs: DepthSlabPyramid;
    mirror: ScreenMirror | null;
    budget: number;
    roughnessCutoff: number;
}
function depthNoisePerSquaredDepth(camera: PerspectiveCamera): number {
    return (DEPTH_NOISE_ULPS * DEPTH_BUFFER_ULP * (camera.far - camera.near)) / (camera.far * camera.near);
}
export class ScreenReflectionPass {
    readonly stats = { drawCalls: 0 };
    texture!: WebGLTexture;
    width = 0;
    height = 0;
    private levels = 0;
    private framebuffer!: WebGLFramebuffer;
    private readonly program: ShaderProgram;
    private readonly inverseView = mat4.create();
    private readonly reprojection = mat4.create();
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly format: ColorFormat, defines: ShaderDefines) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(SCREEN_REFLECTIONS_FRAGMENT_SHADER, defines));
        this.allocate(1, 1);
    }
    get maxLod(): number {
        return this.levels - 1;
    }
    render(input: ScreenReflectionInput, width: number, height: number): void {
        const { gl, program, triangle } = this;
        const { camera, slabs, mirror } = input;
        if (width !== this.width || height !== this.height) {
            this.dispose();
            this.allocate(width, height);
        }
        mat4.invert(this.inverseView, camera.viewMatrix);
        mat4.multiply(this.reprojection, input.history.viewProjection, this.inverseView);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        gl.disable(gl.DEPTH_TEST);
        program.use();
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, input.depth);
        gl.uniform1i(program.uniform('u_sceneDepth'), DEPTH_UNIT);
        gl.activeTexture(gl.TEXTURE0 + SURFACE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, input.surface.texture);
        gl.uniform1i(program.uniform('u_surface'), SURFACE_UNIT);
        gl.activeTexture(gl.TEXTURE0 + HISTORY_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, input.history.texture);
        gl.uniform1i(program.uniform('u_history'), HISTORY_UNIT);
        gl.activeTexture(gl.TEXTURE0 + SLABS_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, slabs.texture);
        gl.uniform1i(program.uniform('u_depthSlabs'), SLABS_UNIT);
        gl.activeTexture(gl.TEXTURE0 + MIRROR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, mirror ? mirror.color : input.history.texture);
        gl.uniform1i(program.uniform('u_mirrorColor'), MIRROR_UNIT);
        gl.uniform1f(program.uniform('u_mirrorEnabled'), mirror ? 1 : 0);
        if (mirror)
            gl.uniform4fv(program.uniform('u_mirrorPlane'), mirror.viewPlane);
        gl.uniformMatrix4fv(program.uniform('u_view'), false, camera.viewMatrix);
        gl.uniformMatrix4fv(program.uniform('u_projection'), false, camera.projectionMatrix);
        gl.uniformMatrix4fv(program.uniform('u_reprojection'), false, this.reprojection);
        gl.uniform2f(program.uniform('u_sceneSize'), this.width, this.height);
        gl.uniform1i(program.uniform('u_slabMaxLevel'), slabs.maxLevel);
        gl.uniform1f(program.uniform('u_traceBudget'), input.budget);
        gl.uniform1f(program.uniform('u_depthQuantum'), depthNoisePerSquaredDepth(camera));
        gl.uniform1f(program.uniform('u_farDistance'), camera.far);
        gl.uniform1f(program.uniform('u_nearPlane'), camera.near);
        gl.uniform1f(program.uniform('u_roughnessCutoff'), input.roughnessCutoff);
        triangle.draw();
        this.stats.drawCalls = 1;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer)
            throw new Error('Não foi possível alocar o alvo dos reflexos em espaço de tela.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.levels = Math.min(MAX_RESULT_LEVELS, Math.floor(Math.log2(Math.max(this.width, this.height))) + 1);
        this.texture = texture;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, this.levels, colorInternalFormat(gl, this.format), this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
}
