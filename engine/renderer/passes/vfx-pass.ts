import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import type { Texture } from '@/engine/core/scene/texture';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import type { GL } from '@/engine/renderer/gl/context';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import type { SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import { SceneDepthCapture } from '@/engine/renderer/gl/scene-depth-capture';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, sceneLightingDefines, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { VFX_BLEND_CODE, VFX_FRAGMENT_SHADER, VFX_INSTANCE_FLOATS, VFX_RENDER_MODE_CODE, VFX_VERTEX_SHADER } from '@/engine/renderer/shaders/vfx.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VfxEmitter } from '@/engine/vfx/document/vfx-document';
import type { EmitterSimulator } from '@/engine/vfx/simulation/emitter-simulator';
import { vfxDocumentExtent } from '@/engine/vfx/simulation/vfx-instance';
import type { VfxDraw } from '@/engine/vfx/world/vfx-system';
const QUAD_VERTICES = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
const SPRITE_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT;
const DEPTH_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT + 1;
const INSTANCE_STRIDE = VFX_INSTANCE_FLOATS * 4;
const IDENTITY = mat4.create();
interface Batch {
    readonly draw: VfxDraw;
    readonly emitter: VfxEmitter;
    readonly simulator: EmitterSimulator;
    readonly texture: Texture | null;
    offset: number;
    count: number;
}
export interface VfxPassInput extends SceneLightingInput {
    readonly frustum: Frustum | null;
    readonly sceneTarget: SceneRenderTarget;
}
export class VfxPass {
    readonly stats = { drawCalls: 0, particles: 0, emitters: 0 };
    private readonly program: ShaderProgram;
    private readonly vao: WebGLVertexArrayObject;
    private readonly quadBuffer: WebGLBuffer;
    private readonly instanceBuffer: WebGLBuffer;
    private readonly depthCopy: SceneDepthCapture;
    private readonly batches: Batch[] = [];
    private instances = new Float32Array(VFX_INSTANCE_FLOATS * 1024);
    private readonly order: number[] = [];
    private keys = new Float32Array(1024);
    private readonly bounds = aabb.create();
    private readonly live = new Map<number, Texture>();
    private readonly seen = new Set<number>();
    private needsDepth = false;
    constructor(private readonly gl: GL, private readonly textures: GpuTextureCache, defines: ShaderDefines) {
        this.program = new ShaderProgram(gl, VFX_VERTEX_SHADER, withDefines(VFX_FRAGMENT_SHADER, sceneLightingDefines(defines, 'direct')));
        this.depthCopy = new SceneDepthCapture(gl, 'partículas');
        const vao = gl.createVertexArray();
        const quadBuffer = gl.createBuffer();
        const instanceBuffer = gl.createBuffer();
        if (!vao || !quadBuffer || !instanceBuffer)
            throw new Error('Não foi possível alocar os buffers das partículas.');
        this.vao = vao;
        this.quadBuffer = quadBuffer;
        this.instanceBuffer = instanceBuffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        for (let location = 1; location <= 6; location++) {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribDivisor(location, 1);
        }
        this.pointInstances(0);
        gl.bindVertexArray(null);
    }
    private pointInstances(offset: number): void {
        const { gl } = this;
        const base = offset * INSTANCE_STRIDE;
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, INSTANCE_STRIDE, base);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, INSTANCE_STRIDE, base + 12);
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, INSTANCE_STRIDE, base + 20);
        gl.vertexAttribPointer(4, 4, gl.FLOAT, false, INSTANCE_STRIDE, base + 24);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, INSTANCE_STRIDE, base + 40);
        gl.vertexAttribPointer(6, 3, gl.FLOAT, false, INSTANCE_STRIDE, base + 44);
    }
    prepare(draws: readonly VfxDraw[], camera: PerspectiveCamera, frustum: Frustum | null): void {
        const { batches, seen, live } = this;
        batches.length = 0;
        seen.clear();
        this.needsDepth = false;
        this.stats.drawCalls = 0;
        this.stats.particles = 0;
        this.stats.emitters = 0;
        const sorted = [...draws].sort((a, b) => b.distance - a.distance);
        let total = 0;
        for (const draw of sorted) {
            const { instance, worldMatrix } = draw;
            const extent = vfxDocumentExtent(instance.document) * draw.settings.scale * Math.hypot(worldMatrix[0], worldMatrix[1], worldMatrix[2]);
            const inView = !frustum || this.sphereInFrustum(frustum, worldMatrix, extent);
            for (const simulator of instance.simulators) {
                const { emitter } = simulator;
                if (!emitter.enabled || simulator.alive === 0)
                    continue;
                if (!inView && emitter.space === 'local')
                    continue;
                const texture = draw.resolveTexture(emitter.renderer.texture);
                if (texture) {
                    seen.add(texture.id);
                    live.set(texture.id, texture);
                }
                if (emitter.renderer.softness > 0)
                    this.needsDepth = true;
                batches.push({ draw, emitter, simulator, texture, offset: total, count: simulator.alive });
                total += simulator.alive;
            }
        }
        if (total * VFX_INSTANCE_FLOATS > this.instances.length)
            this.instances = new Float32Array(Math.ceil(total * VFX_INSTANCE_FLOATS * 1.5));
        for (const batch of batches)
            this.pack(batch, camera);
        this.stats.particles = total;
        this.stats.emitters = batches.length;
        for (const [id, texture] of [...live.entries()]) {
            if (seen.has(id))
                continue;
            this.textures.release(texture);
            live.delete(id);
        }
    }
    private sphereInFrustum(frustum: Frustum, worldMatrix: Float32Array, radius: number): boolean {
        const { bounds } = this;
        const x = worldMatrix[12];
        const y = worldMatrix[13];
        const z = worldMatrix[14];
        bounds.min[0] = x - radius;
        bounds.min[1] = y - radius;
        bounds.min[2] = z - radius;
        bounds.max[0] = x + radius;
        bounds.max[1] = y + radius;
        bounds.max[2] = z + radius;
        return frustum.intersectsAabb(bounds);
    }
    private sortOrder(batch: Batch, camera: PerspectiveCamera): number[] | null {
        const { emitter, simulator, draw } = batch;
        const { sort } = emitter.renderer;
        if (sort === 'none')
            return null;
        const { pool } = simulator;
        const count = pool.count;
        const { order } = this;
        if (this.keys.length < count)
            this.keys = new Float32Array(count);
        const { keys } = this;
        order.length = count;
        for (let i = 0; i < count; i++)
            order[i] = i;
        if (sort === 'distance') {
            const m = emitter.space === 'world' ? IDENTITY : draw.worldMatrix;
            const view = camera.viewMatrix;
            const { position } = pool;
            for (let i = 0; i < count; i++) {
                const px = position[i * 3];
                const py = position[i * 3 + 1];
                const pz = position[i * 3 + 2];
                const wx = m[0] * px + m[4] * py + m[8] * pz + m[12];
                const wy = m[1] * px + m[5] * py + m[9] * pz + m[13];
                const wz = m[2] * px + m[6] * py + m[10] * pz + m[14];
                keys[i] = view[2] * wx + view[6] * wy + view[10] * wz + view[14];
            }
            order.sort((a, b) => keys[a] - keys[b]);
        }
        else {
            const { age } = pool;
            if (sort === 'oldest')
                order.sort((a, b) => age[a] - age[b]);
            else
                order.sort((a, b) => age[b] - age[a]);
        }
        return order;
    }
    private pack(batch: Batch, camera: PerspectiveCamera): void {
        const { pool } = batch.simulator;
        const { position, size, rotation, color, frame, velocity } = pool;
        const data = this.instances;
        const order = this.sortOrder(batch, camera);
        let write = batch.offset * VFX_INSTANCE_FLOATS;
        for (let n = 0; n < pool.count; n++) {
            const i = order ? order[n] : n;
            const p = i * 3;
            data[write] = position[p];
            data[write + 1] = position[p + 1];
            data[write + 2] = position[p + 2];
            data[write + 3] = size[i * 2];
            data[write + 4] = size[i * 2 + 1];
            data[write + 5] = rotation[i];
            data[write + 6] = color[i * 4];
            data[write + 7] = color[i * 4 + 1];
            data[write + 8] = color[i * 4 + 2];
            data[write + 9] = color[i * 4 + 3];
            data[write + 10] = frame[i];
            data[write + 11] = velocity[p];
            data[write + 12] = velocity[p + 1];
            data[write + 13] = velocity[p + 2];
            write += VFX_INSTANCE_FLOATS;
        }
    }
    render(input: VfxPassInput): void {
        const { batches } = this;
        if (batches.length === 0)
            return;
        const { gl, program } = this;
        const { camera, sceneTarget } = input;
        const depth = this.needsDepth ? this.depthCopy.capture(sceneTarget) : null;
        program.use();
        bindSceneLightingUniforms(gl, program, input, 'direct');
        gl.uniformMatrix4fv(program.uniform('u_view'), false, camera.viewMatrix);
        gl.uniform1i(program.uniform('u_sprite'), SPRITE_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_sceneDepth'), DEPTH_TEXTURE_UNIT);
        gl.uniform4f(program.uniform('u_depthParams'), camera.near, camera.far, 1 / sceneTarget.width, 1 / sceneTarget.height);
        gl.activeTexture(gl.TEXTURE0 + DEPTH_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.activeTexture(gl.TEXTURE0 + SPRITE_TEXTURE_UNIT);
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.instances.subarray(0, this.stats.particles * VFX_INSTANCE_FLOATS), gl.DYNAMIC_DRAW);
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        let blend = '';
        for (const batch of batches) {
            const { emitter, draw } = batch;
            const { renderer } = emitter;
            const handle = batch.texture ? this.textures.resolve(batch.texture) : null;
            if (!handle)
                continue;
            gl.bindTexture(gl.TEXTURE_2D, handle);
            if (renderer.blend !== blend) {
                blend = renderer.blend;
                switch (renderer.blend) {
                    case 'additive':
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                        break;
                    case 'premultiplied':
                        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                        break;
                    case 'multiply':
                        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
                        break;
                    default:
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                }
            }
            gl.uniformMatrix4fv(program.uniform('u_model'), false, emitter.space === 'world' ? IDENTITY : draw.worldMatrix);
            gl.uniform1f(program.uniform('u_mode'), VFX_RENDER_MODE_CODE[renderer.mode]);
            gl.uniform1f(program.uniform('u_alignToVelocity'), emitter.modules.some((module) => module.kind === 'rotationOverLife' && module.enabled && module.alignToVelocity) ? 1 : 0);
            gl.uniform1f(program.uniform('u_stretch'), renderer.stretch);
            gl.uniform1f(program.uniform('u_stretchMinimum'), renderer.stretchMinimum);
            gl.uniform2f(program.uniform('u_pivot'), renderer.pivot[0], renderer.pivot[1]);
            gl.uniform2f(program.uniform('u_flipbook'), renderer.flipbook?.columns ?? 1, renderer.flipbook?.rows ?? 1);
            gl.uniform1f(program.uniform('u_blend'), VFX_BLEND_CODE[renderer.blend]);
            gl.uniform1f(program.uniform('u_intensity'), renderer.intensity);
            gl.uniform1f(program.uniform('u_softness'), depth ? renderer.softness : 0);
            gl.uniform1f(program.uniform('u_fadeNear'), renderer.fadeNearCamera);
            gl.uniform1f(program.uniform('u_alphaCutoff'), renderer.alphaCutoff);
            gl.uniform1f(program.uniform('u_lit'), renderer.lighting === 'lit' ? 1 : 0);
            this.pointInstances(batch.offset);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.count);
            this.stats.drawCalls++;
        }
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    dispose(): void {
        const { gl } = this;
        for (const texture of this.live.values())
            this.textures.release(texture);
        this.live.clear();
        this.program.dispose();
        this.depthCopy.dispose();
        gl.deleteBuffer(this.quadBuffer);
        gl.deleteBuffer(this.instanceBuffer);
        gl.deleteVertexArray(this.vao);
    }
}
