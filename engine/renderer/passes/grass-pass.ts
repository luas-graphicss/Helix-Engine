import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { GRASS_VERTEX_SHADER, GRASS_FRAGMENT_SHADER } from '@/engine/renderer/shaders/grass.glsl';
import { bindSceneLightingUniforms, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import { GrassChunkCache, UNBUILT_TIER, type GrassChunk, type TerrainGrassResources } from '@/engine/renderer/foliage/grass-chunk-cache';
import { GrassInteractors } from '@/engine/renderer/foliage/grass-interactors';
import { GRASS_TRAMPLE_TEXTURE_UNIT, GrassTrampleMaps } from '@/engine/renderer/foliage/grass-trample-map';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import type { ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import * as aabb from '@/engine/core/math/aabb';
import { degToRad } from '@/engine/core/math/scalar';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { grassTierForDistance, GRASS_CHUNK_SIZE, GRASS_CLUMP_REACH, GRASS_INSTANCE_BYTES, GRASS_TIERS, } from '@/engine/terrain/foliage/grass-placement';
export interface GrassPassInput extends SceneLightingInput {
    frustum: Frustum | null;
    pixelScale: number;
    elapsedSeconds: number;
}
export interface GrassPassStats {
    drawCalls: number;
    triangles: number;
    blades: number;
    chunks: number;
    pending: number;
    interactors: number;
}
interface BladeStrip {
    vao: WebGLVertexArrayObject;
    buffer: WebGLBuffer;
    vertexCount: number;
    triangles: number;
}
const BUILD_BUDGET_MS = 4;
const MAX_BUILDS_PER_FRAME = 12;
const LOD_REFERENCE_DISTANCE = 14;
const LOD_FALLOFF = 1.6;
const MIN_DRAW_FRACTION = 0.06;
const MIN_BLADE_PIXELS = 1.25;
const MAX_WIDTH_BOOST = 2.5;
const DOWNGRADE_MARGIN = 1.35;
const BOUNDS_MARGIN = 0.2;
const TRAMPLE_LEAN = 1.2;
const TRAMPLE_SHORTEN = 0.25;
interface VisibleChunk {
    chunk: GrassChunk;
    distance: number;
    tier: number;
}
function drawFraction(distance: number): number {
    if (distance <= LOD_REFERENCE_DISTANCE)
        return 1;
    return Math.max(Math.pow(LOD_REFERENCE_DISTANCE / distance, LOD_FALLOFF), MIN_DRAW_FRACTION);
}
export class GrassPass {
    readonly stats: GrassPassStats = { drawCalls: 0, triangles: 0, blades: 0, chunks: 0, pending: 0, interactors: 0 };
    private readonly program: ShaderProgram;
    private readonly cache: GrassChunkCache;
    private readonly trample: GrassTrampleMaps;
    private readonly interactors = new GrassInteractors();
    private readonly strips: BladeStrip[];
    private readonly localBox = aabb.create();
    private readonly worldBox = aabb.create();
    private readonly chunkPool: VisibleChunk[] = [];
    private readonly visibleChunks: VisibleChunk[] = [];
    constructor(private readonly gl: GL, triangle: FullscreenTriangle, trampleFormat: ColorFormat, defines: ShaderDefines = {}) {
        this.program = new ShaderProgram(gl, GRASS_VERTEX_SHADER, withDefines(GRASS_FRAGMENT_SHADER, defines));
        this.cache = new GrassChunkCache(gl);
        this.trample = new GrassTrampleMaps(gl, triangle, trampleFormat);
        this.strips = GRASS_TIERS.map((tier) => this.createStrip(tier.segments));
    }
    updateTrample(scene: Scene, deltaSeconds: number): void {
        const { trample, interactors } = this;
        trample.beginFrame();
        interactors.collect(scene, deltaSeconds);
        for (const entity of interactors.terrains) {
            const terrain = entity.terrain;
            if (!terrain || !terrain.grass.enabled || terrain.grass.density <= 0)
                continue;
            trample.update(entity, terrain, interactors, deltaSeconds);
        }
        this.stats.interactors = trample.stamps;
    }
    private createStrip(segments: number): BladeStrip {
        const { gl } = this;
        const vao = gl.createVertexArray();
        const buffer = gl.createBuffer();
        if (!vao || !buffer)
            throw new Error('Não foi possível criar a geometria da grama.');
        const vertexCount = (segments + 1) * 2;
        const vertices = new Float32Array(vertexCount * 2);
        for (let row = 0; row <= segments; row++) {
            const t = row / segments;
            vertices[row * 4] = -1;
            vertices[row * 4 + 1] = t;
            vertices[row * 4 + 2] = 1;
            vertices[row * 4 + 3] = t;
        }
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribDivisor(1, 1);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribDivisor(2, 1);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribDivisor(3, 1);
        gl.bindVertexArray(null);
        return { vao, buffer, vertexCount, triangles: segments * 2 };
    }
    private bindInstances(buffer: WebGLBuffer): void {
        const { gl } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, GRASS_INSTANCE_BYTES, 0);
        gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, GRASS_INSTANCE_BYTES, 16);
        gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, GRASS_INSTANCE_BYTES, 20);
    }
    render(terrains: readonly Entity[], input: GrassPassInput): void {
        const { gl, program, stats } = this;
        stats.drawCalls = 0;
        stats.triangles = 0;
        stats.blades = 0;
        stats.chunks = 0;
        stats.pending = 0;
        let bound = false;
        for (const entity of terrains) {
            const terrain = entity.terrain;
            if (!terrain || !terrain.grass.enabled || terrain.grass.density <= 0)
                continue;
            if (!bound) {
                program.use();
                bindSceneLightingUniforms(gl, program, input);
                gl.disable(gl.CULL_FACE);
                bound = true;
            }
            this.draw(entity, terrain, input);
        }
        if (bound) {
            gl.bindVertexArray(null);
            gl.enable(gl.CULL_FACE);
        }
        this.cache.endFrame();
        this.trample.endFrame();
    }
    private draw(entity: Entity, terrain: Terrain, input: GrassPassInput): void {
        const { gl, program, stats, strips } = this;
        const resources = this.cache.resolve(terrain);
        const visible = this.collectVisible(entity, terrain, resources, input);
        if (visible === 0)
            return;
        this.rebuildPending(terrain, resources, visible);
        const { grass } = terrain;
        const windAngle = degToRad(grass.windDirection);
        gl.uniformMatrix4fv(program.uniform('u_model'), false, entity.worldMatrix);
        gl.uniform4f(program.uniform('u_blade'), grass.height, grass.width, grass.viewDistance, grass.bend);
        gl.uniform4f(program.uniform('u_wind'), Math.cos(windAngle), Math.sin(windAngle), grass.windStrength, input.elapsedSeconds * grass.windSpeed);
        gl.uniform3fv(program.uniform('u_baseColor'), grass.baseColor);
        gl.uniform3fv(program.uniform('u_tipColor'), grass.tipColor);
        gl.uniform4f(program.uniform('u_look'), grass.colorVariation, grass.groundBlend, grass.translucency, entity.receiveShadows ? 1 : 0);
        const trampleMap = this.trample.resolve(terrain);
        const trampling = grass.trample > 0;
        gl.activeTexture(gl.TEXTURE0 + GRASS_TRAMPLE_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, trampleMap.texture);
        gl.uniform1i(program.uniform('u_trample'), GRASS_TRAMPLE_TEXTURE_UNIT);
        gl.uniform4f(program.uniform('u_trampleParams'), 1 / terrain.size, TRAMPLE_LEAN * grass.trample, TRAMPLE_SHORTEN, trampling ? 1 : 0);
        const lodUniform = program.uniform('u_lod');
        const metersPerPixel = 1 / Math.max(input.pixelScale, 1);
        let currentStrip = -1;
        for (let i = 0; i < visible; i++) {
            const { chunk, distance } = this.visibleChunks[i];
            if (chunk.count === 0 || !chunk.buffer || chunk.tier === UNBUILT_TIER)
                continue;
            const fraction = drawFraction(distance);
            const count = Math.min(chunk.count, Math.max(1, Math.round((chunk.count * fraction) / GRASS_TIERS[chunk.tier].fraction)));
            const widthBoost = Math.min(1 / Math.sqrt(fraction), MAX_WIDTH_BOOST);
            gl.uniform4f(lodUniform, widthBoost, count, metersPerPixel, MIN_BLADE_PIXELS);
            if (currentStrip !== chunk.tier) {
                currentStrip = chunk.tier;
                gl.bindVertexArray(strips[currentStrip].vao);
            }
            const strip = strips[currentStrip];
            this.bindInstances(chunk.buffer);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, strip.vertexCount, count);
            stats.drawCalls++;
            stats.blades += count;
            stats.triangles += count * strip.triangles;
        }
    }
    private collectVisible(entity: Entity, terrain: Terrain, resources: TerrainGrassResources, input: GrassPassInput): number {
        const { localBox, worldBox, chunkPool, visibleChunks } = this;
        const { grass } = terrain;
        const half = terrain.halfSize;
        const bladeReach = grass.height * (1 + grass.heightVariation) + BOUNDS_MARGIN;
        const sideReach = Math.max(bladeReach, GRASS_CLUMP_REACH);
        const cameraPosition = input.camera.position;
        let count = 0;
        for (const chunk of resources.chunks) {
            if (!chunk.dirty && chunk.count === 0)
                continue;
            const x0 = -half + chunk.chunkX * GRASS_CHUNK_SIZE;
            const z0 = -half + chunk.chunkZ * GRASS_CHUNK_SIZE;
            const unbuilt = chunk.tier === UNBUILT_TIER;
            const minY = unbuilt ? terrain.tiles.minHeight : chunk.minY;
            const maxY = unbuilt ? terrain.tiles.maxHeight : chunk.maxY;
            localBox.min[0] = Math.max(x0 - sideReach, -half);
            localBox.min[1] = minY - BOUNDS_MARGIN;
            localBox.min[2] = Math.max(z0 - sideReach, -half);
            localBox.max[0] = Math.min(x0 + GRASS_CHUNK_SIZE + sideReach, half);
            localBox.max[1] = maxY + bladeReach;
            localBox.max[2] = Math.min(z0 + GRASS_CHUNK_SIZE + sideReach, half);
            aabb.transform(worldBox, localBox, entity.worldMatrix);
            const distance = aabb.distanceToPoint(worldBox, cameraPosition);
            if (distance > grass.viewDistance)
                continue;
            if (input.frustum && !input.frustum.intersectsAabb(worldBox))
                continue;
            const tier = grassTierForDistance(distance);
            let slot = chunkPool[count];
            if (!slot) {
                slot = { chunk, distance, tier };
                chunkPool[count] = slot;
            }
            else {
                slot.chunk = chunk;
                slot.distance = distance;
                slot.tier = tier;
            }
            visibleChunks[count] = slot;
            count++;
        }
        visibleChunks.length = count;
        visibleChunks.sort((a, b) => a.distance - b.distance);
        this.stats.chunks += count;
        return count;
    }
    private rebuildPending(terrain: Terrain, resources: TerrainGrassResources, visible: number): void {
        const started = performance.now();
        let builds = 0;
        const exhausted = (): boolean => builds >= MAX_BUILDS_PER_FRAME || (builds > 0 && performance.now() - started > BUILD_BUDGET_MS);
        for (let i = 0; i < visible; i++) {
            const { chunk, tier } = this.visibleChunks[i];
            if (!chunk.dirty && chunk.tier <= tier)
                continue;
            if (exhausted()) {
                this.stats.pending++;
                continue;
            }
            this.cache.build(terrain, resources, chunk, tier);
            builds++;
        }
        for (let i = 0; i < visible; i++) {
            const { chunk, tier, distance } = this.visibleChunks[i];
            if (chunk.dirty || chunk.tier >= tier || distance < GRASS_TIERS[chunk.tier].maxDistance * DOWNGRADE_MARGIN)
                continue;
            if (exhausted())
                return;
            this.cache.build(terrain, resources, chunk, tier);
            builds++;
        }
    }
    dispose(): void {
        const { gl } = this;
        this.program.dispose();
        this.cache.dispose();
        this.trample.dispose();
        for (const strip of this.strips) {
            gl.deleteVertexArray(strip.vao);
            gl.deleteBuffer(strip.buffer);
        }
    }
}
