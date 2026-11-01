import type { GL } from '@/engine/renderer/gl/context';
import { colorInternalFormat, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { SCREEN_REFLECTIONS_FRAGMENT_SHADER } from '../shaders/screen-reflections.glsl';
import type { SceneHistory } from './scene-history';
import type { SurfaceBuffer } from './surface-buffer';
const DEPTH_UNIT = 0;
const SURFACE_UNIT = 1;
const HISTORY_UNIT = 2;
const RESULT_LEVELS = 4;
export interface ScreenReflectionInput {
    camera: PerspectiveCamera;
    depth: WebGLTexture;
    surface: SurfaceBuffer;
    history: SceneHistory;
    sceneWidth: number;
    sceneHeight: number;
    steps: number;
    stride: number;
    roughnessCutoff: number;
}
export class ScreenReflectionPass {
    readonly stats = { drawCalls: 0 };
    texture!: WebGLTexture;
    width = 0;
    height = 0;
    private framebuffer!: WebGLFramebuffer;
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly format: ColorFormat, defines: ShaderDefines) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(SCREEN_REFLECTIONS_FRAGMENT_SHADER, defines));
        this.allocate(1, 1);
    }
    get maxLod(): number {
        return RESULT_LEVELS - 1;
    }
    render(input: ScreenReflectionInput, width: number, height: number): void {
        const { gl, program, triangle } = this;
        const { camera } = input;
        if (width !== this.width || height !== this.height) {
            this.dispose();
            this.allocate(width, height);
        }
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
        gl.uniformMatrix4fv(program.uniform('u_view'), false, camera.viewMatrix);
        gl.uniformMatrix4fv(program.uniform('u_projection'), false, camera.projectionMatrix);
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, camera.inverseViewProjectionMatrix);
        gl.uniformMatrix4fv(program.uniform('u_previousViewProjection'), false, input.history.viewProjection);
        gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
        gl.uniform2f(program.uniform('u_sceneSize'), input.sceneWidth, input.sceneHeight);
        gl.uniform2f(program.uniform('u_targetSize'), this.width, this.height);
        gl.uniform4f(program.uniform('u_traceParams'), input.steps, input.stride, 0.35, camera.far);
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
        this.texture = texture;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, RESULT_LEVELS, colorInternalFormat(gl, this.format), this.width, this.height);
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
