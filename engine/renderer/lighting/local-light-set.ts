import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { effectiveLightRange, lightAnimationFactor, resolveLocalLightColor, shadowFaceCount, type LocalLight } from '@/engine/core/scene/light';
import type { GL } from '@/engine/renderer/gl/context';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import { DataTexture } from '@/engine/renderer/myriad/runtime/data-texture';
import { LIGHT_DATA_WIDTH, LIGHT_FLOATS, LIGHT_TILE_SIZE, LIGHT_TYPE_CODE, MAX_LOCAL_LIGHTS, SHADOW_SLOT_FLOATS, SHADOW_SLOTS_OFFSET, TILE_BITS_PER_CHANNEL, TILES_OFFSET, } from './local-light-layout';
export interface CollectedLocalLight {
    entity: Entity;
    light: LocalLight;
    index: number;
    readonly position: Vec3;
    readonly right: Vec3;
    readonly up: Vec3;
    readonly forward: Vec3;
    range: number;
    readonly radiance: Vec3;
    readonly boundsCenter: Vec3;
    boundsRadius: number;
    importance: number;
    outerAngle: number;
    shadowFaces: number;
    shadowSlot: number;
    faceMode: 0 | 1;
}
export interface LocalLightStats {
    candidates: number;
    visible: number;
    culled: number;
    tilesLit: number;
    tiles: number;
    animated: number;
}
export interface LocalLightDataBinding {
    texture: WebGLTexture;
    count: number;
    tileSize: number;
    tilesX: number;
    tilesOffset: number;
    viewportWidth: number;
    viewportHeight: number;
}
const MIN_RADIANCE = 1e-4;
const corner = vec3.create();
const clip = new Float32Array(4);
const toCamera = vec3.create();
export class LocalLightSet {
    readonly lights: CollectedLocalLight[] = [];
    readonly binding: LocalLightDataBinding;
    readonly stats: LocalLightStats = { candidates: 0, visible: 0, culled: 0, tilesLit: 0, tiles: 0, animated: 0 };
    private readonly data: DataTexture;
    private floats = new Float32Array((TILES_OFFSET + 1024) * 4);
    private readonly candidates: CollectedLocalLight[] = [];
    private readonly pool: CollectedLocalLight[] = [];
    private tileCount = 0;
    private tilesY = 0;
    private width = 0;
    private height = 0;
    constructor(private readonly gl: GL) {
        this.data = new DataTexture(gl, LIGHT_DATA_WIDTH, 'rgba32f', Math.ceil(TILES_OFFSET / LIGHT_DATA_WIDTH) + 1);
        this.binding = { texture: this.data.texture, count: 0, tileSize: LIGHT_TILE_SIZE, tilesX: 0, tilesOffset: TILES_OFFSET, viewportWidth: 1, viewportHeight: 1 };
    }
    collect(scene: Scene, camera: PerspectiveCamera, frustum: Frustum | null, width: number, height: number, seconds: number, maxLights: number, soloId: number | null = null): void {
        const { candidates, lights, stats } = this;
        candidates.length = 0;
        lights.length = 0;
        stats.candidates = 0;
        this.width = width;
        this.height = height;
        this.binding.viewportWidth = Math.max(width, 1);
        this.binding.viewportHeight = Math.max(height, 1);
        let poolIndex = 0;
        let solo = null as CollectedLocalLight | null;
        scene.traverseVisible((entity) => {
            const light = entity.light;
            if (!light || light.type === 'directional' || light.type === 'ambient')
                return;
            stats.candidates++;
            const entry = this.acquire(poolIndex);
            if (!this.resolve(entry, entity, light, seconds))
                return;
            if (frustum && !frustum.intersectsSphere(entry.boundsCenter, entry.boundsRadius))
                return;
            entry.importance = importanceOf(entry, camera.position);
            if (entity.id === soloId)
                solo = entry;
            candidates.push(entry);
            poolIndex++;
        });
        if (solo) {
            candidates.length = 0;
            candidates.push(solo);
        }
        candidates.sort((a, b) => b.importance - a.importance);
        const kept = Math.min(candidates.length, maxLights, MAX_LOCAL_LIGHTS);
        let animated = 0;
        for (let i = 0; i < kept; i++) {
            const entry = candidates[i];
            entry.index = i;
            lights.push(entry);
            if (entry.light.animation !== 'none' && entry.light.animationAmount > 0)
                animated++;
        }
        stats.visible = kept;
        stats.culled = stats.candidates - kept;
        stats.animated = animated;
        this.binding.count = kept;
        this.buildTiles(camera.viewProjectionMatrix);
    }
    upload(): void {
        const { lights, data } = this;
        const needed = TILES_OFFSET + this.tileCount;
        for (const light of lights)
            this.pack(light);
        data.ensureRows(Math.ceil(needed / LIGHT_DATA_WIDTH));
        this.binding.texture = data.texture;
        data.upload(0, needed, this.floats);
    }
    private ensureFloats(texels: number): Float32Array {
        if (this.floats.length < texels * 4) {
            const grown = new Float32Array((texels + 1024) * 4);
            grown.set(this.floats);
            this.floats = grown;
        }
        return this.floats;
    }
    shadowSlotFloats(slot: number): Float32Array {
        const start = (SHADOW_SLOTS_OFFSET * 4) + slot * SHADOW_SLOT_FLOATS;
        return this.floats.subarray(start, start + SHADOW_SLOT_FLOATS);
    }
    private acquire(index: number): CollectedLocalLight {
        let entry = this.pool[index];
        if (!entry) {
            entry = {
                entity: null as unknown as Entity,
                light: null as unknown as LocalLight,
                index: -1,
                position: vec3.create(),
                right: vec3.create(),
                up: vec3.create(),
                forward: vec3.create(),
                range: 0,
                radiance: vec3.create(),
                boundsCenter: vec3.create(),
                boundsRadius: 0,
                importance: 0,
                outerAngle: 0,
                shadowFaces: 0,
                shadowSlot: -1,
                faceMode: 1,
            };
            this.pool[index] = entry;
        }
        return entry;
    }
    private resolve(entry: CollectedLocalLight, entity: Entity, light: LocalLight, seconds: number): boolean {
        const m = entity.worldMatrix;
        entry.entity = entity;
        entry.light = light;
        entry.shadowSlot = -1;
        vec3.set(entry.position, m[12], m[13], m[14]);
        vec3.normalize(entry.right, vec3.set(entry.right, m[0], m[1], m[2]));
        vec3.normalize(entry.up, vec3.set(entry.up, m[4], m[5], m[6]));
        vec3.normalize(entry.forward, vec3.set(entry.forward, -m[8], -m[9], -m[10]));
        const factor = lightAnimationFactor(light, seconds, entity.id);
        resolveLocalLightColor(entry.radiance, light);
        vec3.scale(entry.radiance, entry.radiance, Math.max(light.intensity, 0) * factor);
        if (Math.max(entry.radiance[0], entry.radiance[1], entry.radiance[2]) < MIN_RADIANCE)
            return false;
        const range = effectiveLightRange(light);
        entry.range = range;
        entry.outerAngle = 0;
        entry.faceMode = 1;
        entry.shadowFaces = light.shadow.enabled ? shadowFaceCount(light) : 0;
        switch (light.type) {
            case 'spot': {
                const outer = (Math.min(Math.max(light.outerAngle, 1), 89) * Math.PI) / 180;
                entry.outerAngle = outer;
                entry.faceMode = 0;
                if (outer > Math.PI / 4) {
                    vec3.scaleAndAdd(entry.boundsCenter, entry.position, entry.forward, range * Math.cos(outer));
                    entry.boundsRadius = range * Math.sin(outer);
                }
                else {
                    const half = range / (2 * Math.cos(outer));
                    vec3.scaleAndAdd(entry.boundsCenter, entry.position, entry.forward, half);
                    entry.boundsRadius = half;
                }
                break;
            }
            case 'rect':
                vec3.copy(entry.boundsCenter, entry.position);
                entry.boundsRadius = range + Math.hypot(light.width, light.height) * 0.5;
                break;
            case 'disc':
                vec3.copy(entry.boundsCenter, entry.position);
                entry.boundsRadius = range + light.radius;
                break;
            case 'tube':
                vec3.copy(entry.boundsCenter, entry.position);
                entry.boundsRadius = range + light.length * 0.5;
                break;
            default:
                vec3.copy(entry.boundsCenter, entry.position);
                entry.boundsRadius = range;
        }
        return true;
    }
    private pack(entry: CollectedLocalLight): void {
        const { light } = entry;
        const f = this.floats;
        const o = entry.index * LIGHT_FLOATS;
        const shadow = light.shadow;
        f[o] = entry.position[0];
        f[o + 1] = entry.position[1];
        f[o + 2] = entry.position[2];
        f[o + 3] = entry.range;
        f[o + 4] = entry.radiance[0];
        f[o + 5] = entry.radiance[1];
        f[o + 6] = entry.radiance[2];
        f[o + 7] = LIGHT_TYPE_CODE[light.type];
        f[o + 8] = entry.forward[0];
        f[o + 9] = entry.forward[1];
        f[o + 10] = entry.forward[2];
        f[o + 11] = Math.min(Math.max(light.falloff, 0.5), 6);
        f[o + 12] = entry.right[0];
        f[o + 13] = entry.right[1];
        f[o + 14] = entry.right[2];
        f[o + 15] = Math.max(light.sourceRadius, 0);
        f[o + 16] = entry.up[0];
        f[o + 17] = entry.up[1];
        f[o + 18] = entry.up[2];
        f[o + 19] = Math.min(Math.max(light.specular, 0), 4);
        let spotScale = 0;
        let spotOffset = 1;
        let halfWidth = 0;
        let halfHeight = 0;
        let twoSided = 1;
        switch (light.type) {
            case 'spot': {
                const cosOuter = Math.cos(entry.outerAngle);
                const cosInner = Math.cos((Math.min(Math.max(light.innerAngle, 0), light.outerAngle - 0.01) * Math.PI) / 180);
                spotScale = 1 / Math.max(cosInner - cosOuter, 1e-4);
                spotOffset = -cosOuter * spotScale;
                break;
            }
            case 'rect':
                halfWidth = Math.max(light.width, 0.01) * 0.5;
                halfHeight = Math.max(light.height, 0.01) * 0.5;
                twoSided = light.twoSided ? 1 : 0;
                break;
            case 'disc':
                halfWidth = Math.max(light.radius, 0.01);
                halfHeight = halfWidth;
                twoSided = light.twoSided ? 1 : 0;
                break;
            case 'tube':
                halfWidth = Math.max(light.length, 0.01) * 0.5;
                break;
        }
        f[o + 20] = spotScale;
        f[o + 21] = spotOffset;
        f[o + 22] = halfWidth;
        f[o + 23] = halfHeight;
        f[o + 24] = twoSided;
        f[o + 25] = entry.shadowSlot;
        f[o + 26] = 0.5 + Math.min(Math.max(shadow.softness, 0), 1) * 3.5;
        f[o + 27] = entry.faceMode;
        f[o + 28] = Math.max(shadow.normalBias, 0);
        f[o + 29] = Math.min(Math.max(shadow.strength, 0), 1);
        f[o + 30] = 1 / (entry.range * entry.range);
        f[o + 31] = 0;
    }
}
