import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { TERRAIN_MATERIAL_BAKE_FRAGMENT_SHADER } from '@/engine/renderer/shaders/terrain-material-bake.glsl';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import type { Entity } from '@/engine/core/scene/entity';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import { clamp } from '@/engine/core/math/scalar';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { createRegion, isRegionEmpty } from '@/engine/terrain/core/heightfield';
import type { RegionChangeLog } from '@/engine/terrain/chunks/region-change-log';
import { terrainMaterialSignature } from '@/engine/terrain/materials/terrain-material';
import { materialSupportsGrass } from '@/engine/terrain/foliage/grass-placement';
import type { TerrainGpuCache } from './terrain-gpu-cache';
import { TerrainMaterialUniforms } from './terrain-material-uniforms';
import { MAX_TERRAIN_CACHE_LEVELS, TERRAIN_CACHE_TEXELS_PER_METER, TERRAIN_CACHE_TILE_TEXELS, terrainCacheBaseCoverage, terrainCacheUsableRadius, } from './terrain-cache-layout';
const RETENTION_FRAMES = 300;
const PAGE_EMPTY = -32768;
const RING_FAR_DISTANCE = 0.375;
const STATIC_FAR_DISTANCE = 0.75;
const DEFERRED_PENALTY = 1e6;
export interface TerrainMaterialCacheStats {
    baked: number;
    pending: number;
    levels: number;
    memoryBytes: number;
}
export interface TerrainMaterialCacheBinding {
    readonly albedo: WebGLTexture;
    readonly normal: WebGLTexture;
    readonly pages: WebGLTexture;
    readonly levelParams: Float32Array;
    readonly ringCount: number;
    readonly usableRadius: number;
    readonly texelsPerMeter: number;
    readonly tilesPerSide: number;
    readonly center: Vec3;
}
function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}
function bakeSignature(terrain: Terrain): string {
    const { shading, grass } = terrain;
    const layers = terrain.layers
        .map((layer) => `${terrainMaterialSignature(layer.material)}:${layer.tiling}:${layer.tint[0]},${layer.tint[1]},${layer.tint[2]}:${layer.normalStrength}:${layer.roughness}:${materialSupportsGrass(layer.material) ? 1 : 0}`)
        .join(';');
    const shade = `${shading.heightBlendDepth},${shading.triplanarStart},${shading.triplanarRange},${shading.macroVariation},${shading.macroScale},${shading.distanceTiling},${shading.distanceBlendStart},${shading.distanceBlendEnd}`;
    const grassShade = `${grass.enabled ? 1 : 0},${grass.density},${grass.baseColor[0]},${grass.baseColor[1]},${grass.baseColor[2]}`;
    return `${terrain.resolution}|${terrain.splat.resolution}|${terrain.grassMap.resolution}|${layers}|${shade}|${grassShade}`;
}
function createTextureArray(gl: GL, internalFormat: number, size: number, layers: number, filter: number, wrap: number): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture)
        throw new Error('Não foi possível alocar o cache de material do terreno.');
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, internalFormat, size, size, layers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, wrap);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    return texture;
}
class CacheLevel {
    readonly pages: Int16Array;
    readonly edited: Uint8Array;
    originX: number;
    originZ: number;
    pagesDirty = true;
    far = 0;
    constructor(readonly index: number, readonly coverage: number, readonly tileSize: number, readonly texelSize: number, readonly lodIndex: number, readonly isStatic: boolean, tilesPerSide: number) {
        this.pages = new Int16Array(tilesPerSide * tilesPerSide * 2).fill(PAGE_EMPTY);
        this.edited = new Uint8Array(tilesPerSide * tilesPerSide);
        this.originX = this.originZ = isStatic ? -tilesPerSide / 2 : 0;
    }
}
interface BakeJob {
    clip: TerrainClipmap;
    level: CacheLevel;
    slot: number;
    tileX: number;
    tileZ: number;
    score: number;
}
class TerrainClipmap implements TerrainMaterialCacheBinding {
    readonly albedo: WebGLTexture;
    readonly normal: WebGLTexture;
    readonly pages: WebGLTexture;
    readonly framebuffers: WebGLFramebuffer[] = [];
    readonly levels: CacheLevel[] = [];
    readonly levelParams = new Float32Array(MAX_TERRAIN_CACHE_LEVELS * 4);
    readonly center = vec3.create();
    readonly ringCount: number;
    readonly usableRadius: number;
    readonly texelsPerMeter = TERRAIN_CACHE_TEXELS_PER_METER;
    readonly size: number;
    readonly memoryBytes: number;
    lastUsedFrame = 0;
    private signature = '';
    private heightVersion = -1;
    private splatVersion = -1;
    private grassVersion = -1;
    private readonly region = createRegion();
    constructor(private readonly gl: GL, readonly terrain: Terrain, readonly texels: number, readonly tilesPerSide: number, maxLevels: number) {
        this.size = terrain.size;
        const base = terrainCacheBaseCoverage(texels);
        this.ringCount = Math.max(0, Math.min(maxLevels - 1, Math.ceil(Math.log2(terrain.size / base))));
        this.usableRadius = terrainCacheUsableRadius(base, tilesPerSide);
        for (let k = 0; k < this.ringCount; k++) {
            const coverage = base * 2 ** k;
            this.levels.push(new CacheLevel(k, coverage, coverage / tilesPerSide, coverage / texels, k, false, tilesPerSide));
        }
        this.levels.push(new CacheLevel(this.ringCount, terrain.size, terrain.size / tilesPerSide, terrain.size / texels, Math.log2(terrain.size / base), true, tilesPerSide));
        const levelCount = this.levels.length;
        this.albedo = createTextureArray(gl, gl.SRGB8_ALPHA8, texels, levelCount, gl.LINEAR, gl.REPEAT);
        this.normal = createTextureArray(gl, gl.RGBA8, texels, levelCount, gl.LINEAR, gl.REPEAT);
        this.pages = createTextureArray(gl, gl.RG16I, tilesPerSide, levelCount, gl.NEAREST, gl.CLAMP_TO_EDGE);
        this.memoryBytes = levelCount * (texels * texels * 8 + tilesPerSide * tilesPerSide * 4);
        for (let level = 0; level < levelCount; level++) {
            const framebuffer = gl.createFramebuffer();
            if (!framebuffer)
                throw new Error('Não foi possível alocar o framebuffer do cache de material.');
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.albedo, 0, level);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, this.normal, 0, level);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE)
                throw new Error(`Framebuffer do cache de material incompleto (0x${status.toString(16)}).`);
            this.framebuffers.push(framebuffer);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    prepare(entity: Entity, cameraPosition: Vec3, scratch: Mat4): boolean {
        if (!mat4.invert(scratch, entity.worldMatrix))
            return false;
        mat4.transformPoint(this.center, scratch, cameraPosition);
        for (const level of this.levels) {
            if (level.isStatic)
                continue;
            level.originX = Math.floor((this.center[0] - level.coverage / 2) / level.tileSize);
            level.originZ = Math.floor((this.center[2] - level.coverage / 2) / level.tileSize);
        }
        this.syncFar();
        this.syncSignature();
        this.consumeEdits();
        return true;
    }
    slotOf(tileX: number, tileZ: number): number {
        const tiles = this.tilesPerSide;
        const sx = ((tileX % tiles) + tiles) % tiles;
        const sz = ((tileZ % tiles) + tiles) % tiles;
        return sz * tiles + sx;
    }
    wantedTile(level: CacheLevel, slotX: number, slotZ: number, out: Int32Array): void {
        const tiles = this.tilesPerSide;
        out[0] = level.originX + ((((slotX - level.originX) % tiles) + tiles) % tiles);
        out[1] = level.originZ + ((((slotZ - level.originZ) % tiles) + tiles) % tiles);
    }
    isDirty(level: CacheLevel, slot: number, tileX: number, tileZ: number): boolean {
        return level.edited[slot] !== 0 || level.pages[slot * 2] !== tileX || level.pages[slot * 2 + 1] !== tileZ;
    }
    markBaked(level: CacheLevel, slot: number, tileX: number, tileZ: number): void {
        level.pages[slot * 2] = tileX;
        level.pages[slot * 2 + 1] = tileZ;
        level.edited[slot] = 0;
        level.pagesDirty = true;
    }
    uploadPages(): void {
        const { gl, tilesPerSide } = this;
        let bound = false;
        for (const level of this.levels) {
            if (!level.pagesDirty)
                continue;
            if (!bound) {
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.pages);
                bound = true;
            }
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, level.index, tilesPerSide, tilesPerSide, 1, gl.RG_INTEGER, gl.SHORT, level.pages);
            level.pagesDirty = false;
        }
        if (bound)
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    private syncFar(): void {
        const { shading } = this.terrain;
        const start = Math.max(shading.distanceBlendStart, 0);
        const end = Math.max(shading.distanceBlendEnd, start + 0.5);
        const lastRing = this.ringCount > 0 ? this.levels[this.ringCount - 1] : null;
        for (const level of this.levels) {
            const distance = level.isStatic && lastRing ? lastRing.coverage * STATIC_FAR_DISTANCE : level.coverage * RING_FAR_DISTANCE;
            level.far = smoothstep(start, end, distance);
            const offset = level.index * 4;
            this.levelParams[offset] = level.coverage;
            this.levelParams[offset + 1] = 1 / level.coverage;
            this.levelParams[offset + 2] = level.tileSize;
            this.levelParams[offset + 3] = level.far;
        }
    }
    private syncSignature(): void {
        const signature = bakeSignature(this.terrain);
        if (signature === this.signature)
            return;
        this.signature = signature;
        this.invalidateAll();
    }
    private consumeEdits(): void {
        const { terrain, region } = this;
        if (!terrain.heightLog.collect(this.heightVersion, region))
            this.invalidateAll();
        else if (!isRegionEmpty(region)) {
            this.invalidateRect(terrain.gridToLocal(region.x0 - 1), terrain.gridToLocal(region.z0 - 1), terrain.gridToLocal(region.x1 + 1), terrain.gridToLocal(region.z1 + 1));
        }
        this.heightVersion = terrain.heightVersion;
        this.splatVersion = this.consumeTexelLog(terrain.splatLog, this.splatVersion, terrain.splat.resolution);
        this.grassVersion = this.consumeTexelLog(terrain.grassLog, this.grassVersion, terrain.grassMap.resolution);
    }
    private consumeTexelLog(log: RegionChangeLog, sinceVersion: number, resolution: number): number {
        const { terrain, region } = this;
        if (!log.collect(sinceVersion, region))
            this.invalidateAll();
        else if (!isRegionEmpty(region)) {
            const spacing = terrain.size / (resolution - 1);
            const toLocal = (texel: number) => (texel / (resolution - 1)) * terrain.size - terrain.halfSize;
            this.invalidateRect(toLocal(region.x0) - spacing, toLocal(region.z0) - spacing, toLocal(region.x1) + spacing, toLocal(region.z1) + spacing);
        }
        return log.version;
    }
    private invalidateAll(): void {
        for (const level of this.levels)
            level.edited.fill(1);
    }
    private invalidateRect(x0: number, z0: number, x1: number, z1: number): void {
        const tiles = this.tilesPerSide;
        for (const level of this.levels) {
            const tx0 = Math.max(Math.floor(x0 / level.tileSize), level.originX);
            const tx1 = Math.min(Math.floor(x1 / level.tileSize), level.originX + tiles - 1);
            const tz0 = Math.max(Math.floor(z0 / level.tileSize), level.originZ);
            const tz1 = Math.min(Math.floor(z1 / level.tileSize), level.originZ + tiles - 1);
            for (let tz = tz0; tz <= tz1; tz++) {
                for (let tx = tx0; tx <= tx1; tx++)
                    level.edited[this.slotOf(tx, tz)] = 1;
            }
        }
    }
    dispose(): void {
        const { gl } = this;
        for (const framebuffer of this.framebuffers)
            gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(this.albedo);
        gl.deleteTexture(this.normal);
        gl.deleteTexture(this.pages);
    }
}
export class TerrainMaterialCache {
    readonly stats: TerrainMaterialCacheStats = { baked: 0, pending: 0, levels: 0, memoryBytes: 0 };
    private readonly program: ShaderProgram;
    private readonly materialUniforms: TerrainMaterialUniforms;
    private readonly entries = new Map<Terrain, TerrainClipmap>();
    private readonly texels: number;
    private readonly tilesPerSide: number;
    private readonly maxLevels: number;
    private readonly budget: number;
    private readonly jobs: BakeJob[] = [];
    private jobCount = 0;
    private readonly wanted = new Int32Array(2);
    private readonly scratch = mat4.create();
    private frame = 0;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly resources: TerrainGpuCache, profile: RenderProfile) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, TERRAIN_MATERIAL_BAKE_FRAGMENT_SHADER);
        this.materialUniforms = new TerrainMaterialUniforms(gl);
        this.texels = profile.terrainCacheSize;
        this.tilesPerSide = profile.terrainCacheSize / TERRAIN_CACHE_TILE_TEXELS;
        this.maxLevels = Math.min(profile.terrainCacheLevels, MAX_TERRAIN_CACHE_LEVELS);
        this.budget = profile.terrainCacheTilesPerFrame;
    }
    update(terrains: readonly Entity[], cameraPosition: Vec3, pixelScale: number, enabled: boolean): void {
        const { stats } = this;
        stats.baked = 0;
        stats.pending = 0;
        stats.levels = 0;
        stats.memoryBytes = 0;
        if (!enabled)
            return;
        this.jobCount = 0;
        for (const entity of terrains) {
            const { terrain } = entity;
            if (!terrain)
                continue;
            const clip = this.resolve(terrain);
            if (!clip.prepare(entity, cameraPosition, this.scratch))
                continue;
            clip.lastUsedFrame = this.frame;
            stats.levels += clip.levels.length;
            stats.memoryBytes += clip.memoryBytes;
            this.collect(clip, pixelScale);
        }
        if (this.jobCount > 0)
            stats.baked = this.bake();
        for (const clip of this.entries.values())
            clip.uploadPages();
    }
    binding(terrain: Terrain): TerrainMaterialCacheBinding | null {
        const clip = this.entries.get(terrain);
        return clip && clip.lastUsedFrame === this.frame ? clip : null;
    }
    endFrame(): void {
        this.frame++;
        for (const [terrain, clip] of this.entries) {
            if (this.frame - clip.lastUsedFrame > RETENTION_FRAMES) {
                clip.dispose();
                this.entries.delete(terrain);
            }
        }
    }
    private resolve(terrain: Terrain): TerrainClipmap {
        let clip = this.entries.get(terrain);
        if (clip && clip.size !== terrain.size) {
            clip.dispose();
            clip = undefined;
        }
        if (!clip) {
            clip = new TerrainClipmap(this.gl, terrain, this.texels, this.tilesPerSide, this.maxLevels);
            this.entries.set(terrain, clip);
        }
        return clip;
    }
    private collect(clip: TerrainClipmap, pixelScale: number): void {
        const { tilesPerSide, wanted, stats } = this;
        const { terrain, center } = clip;
        const half = terrain.halfSize;
        const groundX = clamp(center[0], -half, half);
        const groundZ = clamp(center[2], -half, half);
        const heightAbove = center[1] - terrain.heightAtLocal(groundX, groundZ);
        const texelsPerPixel = clip.texelsPerMeter / Math.max(pixelScale, 1);
        for (const level of clip.levels) {
            const { tileSize } = level;
            const halfTile = tileSize / 2;
            for (let slotZ = 0; slotZ < tilesPerSide; slotZ++) {
                for (let slotX = 0; slotX < tilesPerSide; slotX++) {
                    clip.wantedTile(level, slotX, slotZ, wanted);
                    const tileX = wanted[0];
                    const tileZ = wanted[1];
                    const minX = tileX * tileSize;
                    const minZ = tileZ * tileSize;
                    if (minX >= half || minX + tileSize <= -half || minZ >= half || minZ + tileSize <= -half)
                        continue;
                    const slot = slotZ * tilesPerSide + slotX;
                    if (!clip.isDirty(level, slot, tileX, tileZ))
                        continue;
                    stats.pending++;
                    const dx = Math.max(Math.abs(minX + halfTile - center[0]) - halfTile, 0);
                    const dz = Math.max(Math.abs(minZ + halfTile - center[2]) - halfTile, 0);
                    const distance = Math.sqrt(dx * dx + dz * dz + heightAbove * heightAbove);
                    const lodFootprint = Math.log2(Math.max(distance * texelsPerPixel, 1e-6));
                    const score = distance + (lodFootprint - level.lodIndex > 1 ? DEFERRED_PENALTY : 0);
                    this.offer(clip, level, slot, tileX, tileZ, score);
                }
            }
        }
    }
    private offer(clip: TerrainClipmap, level: CacheLevel, slot: number, tileX: number, tileZ: number, score: number): void {
        const { jobs, budget } = this;
        if (this.jobCount === budget && score >= jobs[budget - 1].score)
            return;
        let index = this.jobCount < budget ? this.jobCount++ : budget - 1;
        let job = jobs[index];
        if (!job) {
            job = { clip, level, slot, tileX, tileZ, score };
            jobs[index] = job;
        }
        while (index > 0 && jobs[index - 1].score > score) {
            jobs[index] = jobs[index - 1];
            index--;
        }
        jobs[index] = job;
        job.clip = clip;
        job.level = level;
        job.slot = slot;
        job.tileX = tileX;
        job.tileZ = tileZ;
        job.score = score;
    }
    private bake(): number {
        const { gl, program, triangle, jobs, jobCount, texels, tilesPerSide } = this;
        const tile = TERRAIN_CACHE_TILE_TEXELS;
        program.use();
        this.materialUniforms.bindSamplers(program);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.SCISSOR_TEST);
        let baked = 0;
        for (const clip of this.entries.values()) {
            let terrainBound = false;
            for (const level of clip.levels) {
                let levelBound = false;
                for (let i = 0; i < jobCount; i++) {
                    const job = jobs[i];
                    if (job.clip !== clip || job.level !== level)
                        continue;
                    if (!terrainBound) {
                        this.materialUniforms.bind(program, clip.terrain, this.resources.resolve(clip.terrain));
                        terrainBound = true;
                    }
                    if (!levelBound) {
                        gl.bindFramebuffer(gl.FRAMEBUFFER, clip.framebuffers[level.index]);
                        gl.viewport(0, 0, texels, texels);
                        gl.uniform1f(program.uniform('u_texelSize'), level.texelSize);
                        gl.uniform1f(program.uniform('u_far'), level.far);
                        levelBound = true;
                    }
                    const slotX = job.slot % tilesPerSide;
                    const slotZ = (job.slot - slotX) / tilesPerSide;
                    gl.scissor(slotX * tile, slotZ * tile, tile, tile);
                    gl.uniform4f(program.uniform('u_tile'), job.tileX * level.tileSize, job.tileZ * level.tileSize, slotX * tile, slotZ * tile);
                    triangle.draw();
                    clip.markBaked(level, job.slot, job.tileX, job.tileZ);
                    baked++;
                }
            }
        }
        gl.disable(gl.SCISSOR_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.materialUniforms.unbindArrays();
        return baked;
    }
    dispose(): void {
        for (const clip of this.entries.values())
            clip.dispose();
        this.entries.clear();
        this.program.dispose();
    }
}
