import * as mat4 from '@/engine/core/math/mat4';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import { createTexture, type Texture, type TextureColorSpace } from '@/engine/core/scene/texture';
import { createSphere } from '@/engine/renderer/geometry/primitives';
import { syncCanvasSize, WebGLUnsupportedError, type GL } from '@/engine/renderer/gl/context';
import { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { GpuMesh } from '@/engine/renderer/gl/gpu-mesh';
import { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import { ShaderCompileError, ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { POST_SHADER_VERTEX, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { CompiledGraph } from '@/engine/shader-graph/compiler/graph-compiler';
import { createPreviewSceneImage } from './preview-scene-image';
import { postPreviewFragment, SURFACE_PREVIEW_VERTEX, surfacePreviewFragment } from './preview-shaders.glsl';
export type PreviewTextureResolver = (assetId: string, colorSpace: TextureColorSpace) => Texture | null;
const FIELD_OF_VIEW = degToRad(32);
const NEAR = 0.05;
const FAR = 50;
const CAMERA_DISTANCE = 2.4;
const MAX_PITCH = 85;
const MAX_FRAME_SECONDS = 0.1;
const SCENE_COLOR_UNIT = 0;
const SCENE_DEPTH_UNIT = 1;
const FIRST_GRAPH_TEXTURE_UNIT = 2;
const ORIGIN = vec3.create(0, 0, 0);
const UP = vec3.create(0, 1, 0);
const SUN_DIRECTION = vec3.normalize(vec3.create(), vec3.create(0.45, 0.75, 0.5));
const SUN_RADIANCE = vec3.create(3.2, 3.0, 2.8);
export class GraphPreviewRenderer {
    error: string | null = null;
    private readonly gl: GL;
    private readonly textures: GpuTextureCache;
    private readonly sphere: GpuMesh;
    private readonly triangle: FullscreenTriangle;
    private readonly sceneImage: Texture;
    private readonly view = mat4.create();
    private readonly projection = mat4.create();
    private readonly viewProjection = mat4.create();
    private readonly inverseViewProjection = mat4.create();
    private readonly eye = vec3.create();
    private program: ShaderProgram | null = null;
    private programModel: ShaderModel = 'surface';
    private programKey: string | null = null;
    private yaw = 30;
    private pitch = 15;
    private lastSeconds = 0;
    constructor(private readonly canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, depth: true, premultipliedAlpha: true });
        if (!gl)
            throw new WebGLUnsupportedError();
        this.gl = gl;
        this.textures = new GpuTextureCache(gl);
        this.sphere = new GpuMesh(gl, createSphere(0.5, 64, 32));
        this.triangle = new FullscreenTriangle(gl);
        this.sceneImage = createTexture({ name: 'Cena de teste do Shader Graph', image: createPreviewSceneImage(), colorSpace: 'linear', wrapS: 'clamp', wrapT: 'clamp' });
    }
    orbit(deltaYaw: number, deltaPitch: number): void {
        this.yaw = (this.yaw + deltaYaw) % 360;
        this.pitch = clamp(this.pitch + deltaPitch, -MAX_PITCH, MAX_PITCH);
    }
    render(compiled: CompiledGraph, resolveTexture: PreviewTextureResolver, timeMs: number): void {
        const { gl, canvas } = this;
        syncCanvasSize(canvas);
        const { width, height } = canvas;
        const seconds = timeMs / 1000;
        const delta = this.lastSeconds > 0 ? Math.min(seconds - this.lastSeconds, MAX_FRAME_SECONDS) : 0;
        this.lastSeconds = seconds;
        this.ensureProgram(compiled);
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const { program } = this;
        if (!program)
            return;
        this.updateCamera(width / Math.max(height, 1));
        program.use();
        gl.uniform1f(program.uniform('uTime'), seconds);
        gl.uniform1f(program.uniform('uDelta'), delta);
        gl.uniform1f(program.uniform('uNear'), NEAR);
        gl.uniform1f(program.uniform('uFar'), FAR);
        gl.uniform2f(program.uniform('uResolution'), width, height);
        gl.uniformMatrix4fv(program.uniform('uView'), false, this.view);
        gl.uniformMatrix4fv(program.uniform('uProjection'), false, this.projection);
        gl.uniformMatrix4fv(program.uniform('uViewProjection'), false, this.viewProjection);
        gl.uniformMatrix4fv(program.uniform('uInverseViewProjection'), false, this.inverseViewProjection);
        this.bindGraphUniforms(program, compiled, resolveTexture);
        if (this.programModel === 'surface')
            this.drawSurface(program, compiled.translucent);
        else
            this.drawPost(program);
    }
    dispose(): void {
        this.program?.dispose();
        this.sphere.dispose();
        this.triangle.dispose();
        this.textures.dispose();
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    private ensureProgram(compiled: CompiledGraph): void {
        if (compiled.source === '')
            return;
        const key = `${compiled.model}\n${compiled.source}`;
        if (key === this.programKey)
            return;
        this.programKey = key;
        const candidate = compiled.model === 'surface'
            ? new ShaderProgram(this.gl, SURFACE_PREVIEW_VERTEX, surfacePreviewFragment(compiled.source))
            : new ShaderProgram(this.gl, POST_SHADER_VERTEX, postPreviewFragment(compiled.source));
        try {
            candidate.use();
        }
        catch (cause) {
            candidate.dispose();
            this.error = cause instanceof ShaderCompileError ? cause.log : cause instanceof Error ? cause.message : String(cause);
            return;
        }
        this.program?.dispose();
        this.program = candidate;
        this.programModel = compiled.model;
        this.error = null;
    }
    private updateCamera(aspect: number): void {
        const yaw = degToRad(this.yaw);
        const pitch = degToRad(this.pitch);
        vec3.set(this.eye, Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE, Math.sin(pitch) * CAMERA_DISTANCE, Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE);
        mat4.lookAt(this.view, this.eye, ORIGIN, UP);
        mat4.perspective(this.projection, FIELD_OF_VIEW, Math.max(aspect, 0.001), NEAR, FAR);
        mat4.multiply(this.viewProjection, this.projection, this.view);
        if (!mat4.invert(this.inverseViewProjection, this.viewProjection))
            mat4.identity(this.inverseViewProjection);
    }
    private bindGraphUniforms(program: ShaderProgram, compiled: CompiledGraph, resolveTexture: PreviewTextureResolver): void {
        const { gl } = this;
        let unit = FIRST_GRAPH_TEXTURE_UNIT;
        for (const uniform of compiled.uniforms) {
            const location = program.uniform(uniform.name);
            if (uniform.kind === 'numeric') {
                this.setNumeric(location, uniform.value);
                continue;
            }
            const texture = uniform.assetId ? resolveTexture(uniform.assetId, uniform.colorSpace) : null;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, (texture ? this.textures.resolve(texture) : null) ?? this.textures.white);
            gl.uniform1i(location, unit);
            unit++;
        }
    }
    private setNumeric(location: WebGLUniformLocation | null, value: readonly number[]): void {
        const { gl } = this;
        const [x = 0, y = 0, z = 0, w = 0] = value;
        switch (value.length) {
            case 1:
                gl.uniform1f(location, x);
                return;
            case 2:
                gl.uniform2f(location, x, y);
                return;
            case 3:
                gl.uniform3f(location, x, y, z);
                return;
            default:
                gl.uniform4f(location, x, y, z, w);
        }
    }
    private drawSurface(program: ShaderProgram, translucent: boolean): void {
        const { gl } = this;
        gl.uniformMatrix4fv(program.uniform('u_previewViewProjection'), false, this.viewProjection);
        gl.uniform3fv(program.uniform('u_cameraPosition'), this.eye);
        gl.uniform3fv(program.uniform('u_sunDirection'), SUN_DIRECTION);
        gl.uniform3fv(program.uniform('u_sunRadiance'), SUN_RADIANCE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        if (translucent) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        else
            gl.disable(gl.BLEND);
        this.sphere.draw();
    }
    private drawPost(program: ShaderProgram): void {
        const { gl, textures } = this;
        gl.uniform3fv(program.uniform('uCameraPosition'), this.eye);
        gl.uniform3fv(program.uniform('uSunDirection'), SUN_DIRECTION);
        gl.uniform3fv(program.uniform('uSunColor'), SUN_RADIANCE);
        gl.activeTexture(gl.TEXTURE0 + SCENE_COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, textures.resolve(this.sceneImage) ?? textures.white);
        gl.uniform1i(program.uniform('uSceneColor'), SCENE_COLOR_UNIT);
        gl.activeTexture(gl.TEXTURE0 + SCENE_DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, textures.white);
        gl.uniform1i(program.uniform('uSceneDepth'), SCENE_DEPTH_UNIT);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        this.triangle.draw();
    }
}
