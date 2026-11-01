import * as mat4 from '@/engine/core/math/mat4';
import type { Texture } from '@/engine/core/scene/texture';
import type { GL } from '@/engine/renderer/gl/context';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, sceneLightingDefines, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { GUI_SURFACE_OVERLAY_FRAGMENT_SHADER, GUI_SURFACE_SCENE_FRAGMENT_SHADER, GUI_SURFACE_VERTEX_SHADER } from '@/engine/renderer/shaders/gui-surface.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createSurfaceFrame, resolveSurfaceFrame, surfaceModelMatrix, type GuiSurfaceFrame } from '@/engine/gui/world/gui-surface-frame';
import type { GuiSurfaceDraw } from '@/engine/gui/world/gui-surface-system';
import type { GuiSurfaceBlend } from '@/engine/gui/world/gui-surface-settings';
const QUAD_VERTICES = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
const BLEND_CODE: Record<GuiSurfaceBlend, number> = { opaque: 0, cutout: 1, transparent: 2 };
const LIT_ROUGHNESS = 0.75;
interface PreparedDraw {
    readonly draw: GuiSurfaceDraw;
    readonly frame: GuiSurfaceFrame;
}
export class GuiSurfacePass {
    readonly stats = { drawCalls: 0, surfaces: 0 };
    private readonly sceneProgram: ShaderProgram;
    private readonly overlayProgram: ShaderProgram;
    private readonly vao: WebGLVertexArrayObject;
    private readonly buffer: WebGLBuffer;
    private readonly model = mat4.create();
    private readonly opaque: PreparedDraw[] = [];
    private readonly transparent: PreparedDraw[] = [];
    private readonly overlay: PreparedDraw[] = [];
    private readonly framePool: GuiSurfaceFrame[] = [];
    private readonly live = new Map<number, Texture>();
    private readonly seen = new Set<number>();
    constructor(private readonly gl: GL, private readonly textures: GpuTextureCache, defines: ShaderDefines) {
        this.sceneProgram = new ShaderProgram(gl, GUI_SURFACE_VERTEX_SHADER, withDefines(GUI_SURFACE_SCENE_FRAGMENT_SHADER, sceneLightingDefines(defines, 'direct')));
        this.overlayProgram = new ShaderProgram(gl, GUI_SURFACE_VERTEX_SHADER, GUI_SURFACE_OVERLAY_FRAGMENT_SHADER);
        const vao = gl.createVertexArray();
        const buffer = gl.createBuffer();
        if (!vao || !buffer)
            throw new Error('Não foi possível alocar o quad das interfaces no mundo.');
        this.vao = vao;
        this.buffer = buffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }
    prepare(draws: readonly GuiSurfaceDraw[], camera: PerspectiveCamera): void {
        const { opaque, transparent, overlay, seen, live } = this;
        opaque.length = 0;
        transparent.length = 0;
        overlay.length = 0;
        seen.clear();
        this.stats.drawCalls = 0;
        this.stats.surfaces = draws.length;
        for (let i = 0; i < draws.length; i++) {
            const draw = draws[i];
            const frame = this.framePool[i] ?? (this.framePool[i] = createSurfaceFrame());
            resolveSurfaceFrame(frame, draw.local, draw.settings.mount, draw.worldMatrix, camera);
            seen.add(draw.texture.id);
            live.set(draw.texture.id, draw.texture);
            const prepared: PreparedDraw = { draw, frame };
            if (draw.settings.shading === 'overlay')
                overlay.push(prepared);
            else if (draw.settings.blend === 'transparent')
                transparent.push(prepared);
            else
                opaque.push(prepared);
        }
        transparent.sort((a, b) => b.frame.distance - a.frame.distance);
        overlay.sort((a, b) => b.frame.distance - a.frame.distance);
        for (const [id, texture] of [...live.entries()]) {
            if (seen.has(id))
                continue;
            this.textures.release(texture);
            live.delete(id);
        }
    }
    renderOpaque(input: SceneLightingInput): void {
        if (this.opaque.length === 0)
            return;
        this.beginScene(input);
        this.drawList(this.opaque, this.sceneProgram, input.selection);
        this.endDraw();
    }
    renderTransparent(input: SceneLightingInput): void {
        if (this.transparent.length === 0)
            return;
        const { gl } = this;
        this.beginScene(input);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.drawList(this.transparent, this.sceneProgram, input.selection);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        this.endDraw();
    }
    renderOverlay(camera: PerspectiveCamera): void {
        if (this.overlay.length === 0)
            return;
        const { gl, overlayProgram } = this;
        overlayProgram.use();
        gl.uniformMatrix4fv(overlayProgram.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.uniform1i(overlayProgram.uniform('u_surface'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.drawList(this.overlay, overlayProgram, null);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        this.endDraw();
    }
    private beginScene(input: SceneLightingInput): void {
        const { gl, sceneProgram } = this;
        sceneProgram.use();
        bindSceneLightingUniforms(gl, sceneProgram, input, 'direct');
        gl.uniform1i(sceneProgram.uniform('u_surface'), FIRST_PASS_TEXTURE_UNIT);
        gl.uniform1f(sceneProgram.uniform('u_roughness'), LIT_ROUGHNESS);
        gl.activeTexture(gl.TEXTURE0 + FIRST_PASS_TEXTURE_UNIT);
    }
    private drawList(list: readonly PreparedDraw[], program: ShaderProgram, selection: ReadonlySet<number> | null): void {
        const { gl, model } = this;
        const isScene = program === this.sceneProgram;
        gl.bindVertexArray(this.vao);
        let culling = true;
        let depthTest = true;
        for (const { draw, frame } of list) {
            const { settings } = draw;
            const handle = this.textures.resolve(draw.texture);
            if (!handle)
                continue;
            gl.bindTexture(gl.TEXTURE_2D, handle);
            gl.uniformMatrix4fv(program.uniform('u_model'), false, surfaceModelMatrix(model, frame));
            gl.uniform1f(program.uniform('u_blend'), BLEND_CODE[settings.blend]);
            gl.uniform1f(program.uniform('u_brightness'), settings.brightness);
            gl.uniform1f(program.uniform('u_opacity'), settings.opacity);
            if (isScene) {
                gl.uniform3fv(program.uniform('u_normal'), frame.normal);
                gl.uniform1f(program.uniform('u_shading'), settings.shading === 'lit' ? 0 : 1);
                gl.uniform1f(program.uniform('u_selected'), selection?.has(draw.entityId) ? 1 : 0);
            }
            else {
                const wantsDepth = !settings.alwaysOnTop;
                if (wantsDepth !== depthTest) {
                    depthTest = wantsDepth;
                    if (wantsDepth)
                        gl.enable(gl.DEPTH_TEST);
                    else
                        gl.disable(gl.DEPTH_TEST);
                }
            }
            const wantsCulling = !settings.doubleSided;
            if (wantsCulling !== culling) {
                culling = wantsCulling;
                if (wantsCulling)
                    gl.enable(gl.CULL_FACE);
                else
                    gl.disable(gl.CULL_FACE);
            }
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            this.stats.drawCalls++;
        }
        if (!culling)
            gl.enable(gl.CULL_FACE);
        gl.bindVertexArray(null);
    }
    private endDraw(): void {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }
    dispose(): void {
        const { gl } = this;
        for (const texture of this.live.values())
            this.textures.release(texture);
        this.live.clear();
        this.sceneProgram.dispose();
        this.overlayProgram.dispose();
        gl.deleteBuffer(this.buffer);
        gl.deleteVertexArray(this.vao);
    }
}
