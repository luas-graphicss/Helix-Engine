import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { InstanceLayout } from '@/engine/renderer/gl/instance-layout';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { FIRST_PASS_TEXTURE_UNIT } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { GRASS_TRAMPLE_RECOVER_FRAGMENT_SHADER, GRASS_TRAMPLE_RECOVER_VERTEX_SHADER, GRASS_TRAMPLE_STAMP_FRAGMENT_SHADER, GRASS_TRAMPLE_STAMP_VERTEX_SHADER, } from '@/engine/renderer/shaders/grass-trample.glsl';
import type { Entity } from '@/engine/core/scene/entity';
import type { Terrain } from '@/engine/terrain/core/terrain';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import { INTERACTOR_AXES, INTERACTOR_BOTTOM, INTERACTOR_FLOATS, INTERACTOR_RADIUS, INTERACTOR_VELOCITY, type GrassInteractors, } from './grass-interactors';
export const GRASS_TRAMPLE_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT;
const TEXELS_PER_METER = 8;
const MIN_RESOLUTION = 64;
const MAX_RESOLUTION = 1024;
const MIN_RECOVERY_STEP = 1 / 255;
const RETENTION_FRAMES = 120;
const REST_COLOR: [
    number,
    number,
    number,
    number
] = [0.5, 0.5, 0, 1];
const FULL_PUSH_SPEED = 3;
const MAX_PUSH = 0.8;
const STAMP_LAYOUT = new InstanceLayout([
    { location: 1, size: 4, offset: 0 },
    { location: 2, size: 4, offset: 4 },
    { location: 3, size: 3, offset: 8 },
], 12);
const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const inverse = mat4.create();
const point = vec3.create();
const local = vec3.create();
const segmentX = new Float32Array(3);
const segmentZ = new Float32Array(3);
class TrampleMap {
    front: ColorRenderTarget;
    back: ColorRenderTarget;
    lastUsedFrame = 0;
    pendingRecovery = 0;
    idleSeconds = Infinity;
    constructor(private readonly gl: GL, readonly resolution: number, format: ColorFormat) {
        const options = { width: resolution, height: resolution, format, filter: 'linear' as const };
        this.front = new ColorRenderTarget(gl, options);
        this.back = new ColorRenderTarget(gl, options);
        this.clear(this.front);
        this.clear(this.back);
    }
    get texture(): WebGLTexture {
        return this.front.texture;
    }
    swap(): void {
        const { front } = this;
        this.front = this.back;
        this.back = front;
    }
    private clear(target: ColorRenderTarget): void {
        const { gl } = this;
        target.bind();
        gl.clearColor(...REST_COLOR);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dispose(): void {
        this.front.dispose();
        this.back.dispose();
    }
}
export class GrassTrampleMaps {
    stamps = 0;
    private readonly recoverProgram: ShaderProgram;
    private readonly stampProgram: ShaderProgram;
    private readonly stampVao: WebGLVertexArrayObject;
    private readonly cornerBuffer: WebGLBuffer;
    private readonly stampInstances: InstanceBuffer;
    private readonly maps = new Map<Terrain, TrampleMap>();
    private frame = 0;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly format: ColorFormat) {
        this.recoverProgram = new ShaderProgram(gl, GRASS_TRAMPLE_RECOVER_VERTEX_SHADER, GRASS_TRAMPLE_RECOVER_FRAGMENT_SHADER);
        this.stampProgram = new ShaderProgram(gl, GRASS_TRAMPLE_STAMP_VERTEX_SHADER, GRASS_TRAMPLE_STAMP_FRAGMENT_SHADER);
        this.stampInstances = new InstanceBuffer(gl, STAMP_LAYOUT);
        const vao = gl.createVertexArray();
        const cornerBuffer = gl.createBuffer();
        if (!vao || !cornerBuffer)
            throw new Error('Não foi possível criar a geometria dos carimbos de grama.');
        this.stampVao = vao;
        this.cornerBuffer = cornerBuffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        STAMP_LAYOUT.bind(gl, this.stampInstances.buffer, 0);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    beginFrame(): void {
        this.stamps = 0;
    }
    resolve(terrain: Terrain): TrampleMap {
        const resolution = clamp(Math.round(terrain.size * TEXELS_PER_METER), MIN_RESOLUTION, MAX_RESOLUTION);
        let map = this.maps.get(terrain);
        if (map && map.resolution !== resolution) {
            map.dispose();
            map = undefined;
        }
        if (!map) {
            map = new TrampleMap(this.gl, resolution, this.format);
            this.maps.set(terrain, map);
        }
        map.lastUsedFrame = this.frame;
        return map;
    }
    update(entity: Entity, terrain: Terrain, interactors: GrassInteractors, deltaSeconds: number): void {
        const map = this.resolve(terrain);
        const recovery = Math.max(terrain.grass.recoverySeconds, 0.05);
        const stampCount = this.collectStamps(entity, terrain, interactors);
        this.stamps += stampCount;
        map.idleSeconds = stampCount > 0 ? 0 : map.idleSeconds + deltaSeconds;
        if (stampCount === 0 && map.idleSeconds > recovery + 1)
            return;
        map.pendingRecovery += deltaSeconds / recovery;
        let step = 0;
        if (map.pendingRecovery >= MIN_RECOVERY_STEP) {
            step = map.pendingRecovery;
            map.pendingRecovery = 0;
        }
        if (step === 0 && stampCount === 0)
            return;
        this.render(map, terrain.halfSize, step, stampCount);
    }
    private render(map: TrampleMap, halfSize: number, step: number, stampCount: number): void {
        const { gl, recoverProgram, stampProgram } = this;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        map.back.bind();
        gl.activeTexture(gl.TEXTURE0 + GRASS_TRAMPLE_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, map.front.texture);
        recoverProgram.use();
        gl.uniform1i(recoverProgram.uniform('u_previous'), GRASS_TRAMPLE_TEXTURE_UNIT);
        gl.uniform1f(recoverProgram.uniform('u_recovery'), step);
        this.triangle.draw();
        if (stampCount > 0) {
            this.stampInstances.upload();
            stampProgram.use();
            gl.uniform1i(stampProgram.uniform('u_previous'), GRASS_TRAMPLE_TEXTURE_UNIT);
            gl.uniform1f(stampProgram.uniform('u_recovery'), step);
            gl.uniform1f(stampProgram.uniform('u_halfSize'), halfSize);
            gl.bindVertexArray(this.stampVao);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, stampCount);
            gl.bindVertexArray(null);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        map.swap();
    }
    private collectStamps(entity: Entity, terrain: Terrain, interactors: GrassInteractors): number {
        const stamps = this.stampInstances;
        stamps.begin();
        const { grass } = terrain;
        if (interactors.count === 0 || grass.trample <= 0)
            return 0;
        if (!mat4.invert(inverse, entity.worldMatrix))
            return 0;
        const half = terrain.halfSize;
        const toLocal = Math.hypot(inverse[0], inverse[1], inverse[2]);
        const grassTop = grass.height * (1 + grass.heightVariation * 0.7) + 0.05;
        const feather = (0.15 + grass.height * 0.5) * toLocal;
        const { data } = interactors;
        for (let i = 0; i < interactors.count; i++) {
            const base = i * INTERACTOR_FLOATS;
            vec3.set(point, data[base], data[base + 1], data[base + 2]);
            mat4.transformPoint(local, inverse, point);
            const lx = local[0];
            const lz = local[2];
            vec3.set(point, data[base], data[base + INTERACTOR_BOTTOM], data[base + 2]);
            mat4.transformPoint(local, inverse, point);
            const bottom = local[1];
            const ground = terrain.heightAtLocal(clamp(lx, -half, half), clamp(lz, -half, half));
            const press = clamp((ground + grassTop - bottom) / grassTop, 0, 1);
            const strength = press * grass.trample;
            if (strength <= 1e-3)
                continue;
            let longest = 0;
            let cos = 1;
            let sin = 0;
            for (let k = 0; k < 3; k++) {
                const offset = base + INTERACTOR_AXES + k * 3;
                vec3.set(point, data[offset], data[offset + 1], data[offset + 2]);
                mat4.transformDirection(local, inverse, point);
                segmentX[k] = local[0];
                segmentZ[k] = local[2];
                const squared = local[0] * local[0] + local[2] * local[2];
                if (squared > longest) {
                    longest = squared;
                    const length = Math.sqrt(squared);
                    cos = local[0] / length;
                    sin = local[2] / length;
                }
            }
            const radius = data[base + INTERACTOR_RADIUS] * toLocal;
            let extentX = radius;
            let extentZ = radius;
            for (let k = 0; k < 3; k++) {
                extentX += Math.abs(segmentX[k] * cos + segmentZ[k] * sin);
                extentZ += Math.abs(-segmentX[k] * sin + segmentZ[k] * cos);
            }
            const rounding = Math.min(radius > 0 ? radius : 0.08 * toLocal, extentX, extentZ);
            const reach = Math.max(extentX, extentZ) + feather;
            if (lx + reach < -half || lx - reach > half || lz + reach < -half || lz - reach > half)
                continue;
            vec3.set(point, data[base + INTERACTOR_VELOCITY], 0, data[base + INTERACTOR_VELOCITY + 1]);
            mat4.transformDirection(local, inverse, point);
            const speed = Math.hypot(local[0], local[2]);
            let pushX = 0;
            let pushZ = 0;
            if (speed > 1e-3) {
                const push = (Math.min(speed / FULL_PUSH_SPEED, 1) * MAX_PUSH) / speed;
                pushX = local[0] * push;
                pushZ = local[2] * push;
            }
            const slot = stamps.allocate(1) * STAMP_LAYOUT.floatsPerInstance;
            const out = stamps.data;
            out[slot] = lx;
            out[slot + 1] = lz;
            out[slot + 2] = cos;
            out[slot + 3] = sin;
            out[slot + 4] = extentX;
            out[slot + 5] = extentZ;
            out[slot + 6] = rounding;
            out[slot + 7] = feather;
            out[slot + 8] = pushX;
            out[slot + 9] = pushZ;
            out[slot + 10] = strength;
            out[slot + 11] = 0;
        }
        return stamps.count;
    }
    endFrame(): void {
        this.frame++;
        for (const [terrain, map] of this.maps) {
            if (this.frame - map.lastUsedFrame > RETENTION_FRAMES) {
                map.dispose();
                this.maps.delete(terrain);
            }
        }
    }
    dispose(): void {
        const { gl } = this;
        for (const map of this.maps.values())
            map.dispose();
        this.maps.clear();
        this.recoverProgram.dispose();
        this.stampProgram.dispose();
        this.stampInstances.dispose();
        gl.deleteVertexArray(this.stampVao);
        gl.deleteBuffer(this.cornerBuffer);
    }
}
