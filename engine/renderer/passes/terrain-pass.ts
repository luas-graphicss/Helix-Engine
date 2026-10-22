import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER } from '@/engine/renderer/shaders/terrain.glsl';
import { DEPTH_ONLY_FRAGMENT_SHADER } from '@/engine/renderer/shaders/depth-prepass.glsl';
import { bindSceneLightingUniforms, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { TerrainGpuCache } from '@/engine/renderer/terrain/terrain-gpu-cache';
import type { TerrainMaterialCache } from '@/engine/renderer/terrain/terrain-material-cache';
import { bindTerrainGeometryUniforms, TerrainMaterialUniforms } from '@/engine/renderer/terrain/terrain-material-uniforms';
import { TERRAIN_TILE_INSTANCE_LAYOUT, type TerrainPatchGeometry } from '@/engine/renderer/terrain/terrain-patch-geometry';
import { TerrainTileSelector, type TerrainTileBatch, type TerrainTileStats } from '@/engine/renderer/terrain/terrain-tile-selector';
import { TERRAIN_CACHE_ALBEDO_TEXTURE_UNIT, TERRAIN_CACHE_NORMAL_TEXTURE_UNIT, TERRAIN_CACHE_PAGES_TEXTURE_UNIT, TERRAIN_HEIGHT_TEXTURE_UNIT, } from '@/engine/renderer/terrain/terrain-texture-units';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import type { Entity } from '@/engine/core/scene/entity';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Terrain } from '@/engine/terrain/core/terrain';
export interface TerrainBrushOverlay {
    entityId: number;
    x: number;
    z: number;
    radius: number;
    innerRadius: number;
    color: Vec3;
}
export interface TerrainPassInput extends SceneLightingInput {
    brush: TerrainBrushOverlay | null;
    frustum: Frustum | null;
    pixelScale: number;
    lod: LodSettings;
}
export interface TerrainPassStats extends TerrainTileStats {
    drawCalls: number;
    triangles: number;
}
interface PreparedTerrain {
    entity: Entity;
    terrain: Terrain;
    normalMatrix: Float32Array;
    batches: TerrainTileBatch[];
    batchCount: number;
}
export class TerrainPass {
    readonly stats: TerrainPassStats;
    private readonly program: ShaderProgram;
    private readonly depthProgram: ShaderProgram;
    readonly selector = new TerrainTileSelector();
    private readonly instances: InstanceBuffer;
    private readonly material: TerrainMaterialUniforms;
    private readonly prepared: PreparedTerrain[] = [];
    private preparedCount = 0;
    constructor(private readonly gl: GL, private readonly patch: TerrainPatchGeometry, private readonly resources: TerrainGpuCache, private readonly cache: TerrainMaterialCache, defines: ShaderDefines = {}) {
        this.program = new ShaderProgram(gl, TERRAIN_VERTEX_SHADER, withDefines(TERRAIN_FRAGMENT_SHADER, defines));
        this.depthProgram = new ShaderProgram(gl, TERRAIN_VERTEX_SHADER, DEPTH_ONLY_FRAGMENT_SHADER);
        this.instances = new InstanceBuffer(gl, TERRAIN_TILE_INSTANCE_LAYOUT);
        this.material = new TerrainMaterialUniforms(gl);
        this.stats = { drawCalls: 0, triangles: 0, tiles: 0, drawn: 0, perLevel: this.selector.stats.perLevel };
    }
    prepare(terrains: readonly Entity[], input: TerrainPassInput): void {
        const { selector, instances } = this;
        this.stats.drawCalls = 0;
        this.stats.triangles = 0;
        selector.beginFrame();
        this.preparedCount = 0;
        instances.begin();
        for (const entity of terrains) {
            const { terrain } = entity;
            if (!terrain)
                continue;
            const slot = this.acquirePrepared(entity, terrain);
            if (!mat4.normalMatrix(slot.normalMatrix, entity.worldMatrix))
                continue;
            selector.selectForCamera(entity, terrain, input.frustum, input.camera.position, input.pixelScale, input.lod, instances);
            if (selector.batches.length === 0)
                continue;
            this.copyBatches(slot, selector.batches);
            this.preparedCount++;
        }
        if (instances.count > 0)
            instances.upload();
        this.stats.tiles = selector.stats.tiles;
        this.stats.drawn = selector.stats.drawn;
    }
    renderDepth(input: TerrainPassInput): void {
        if (this.preparedCount === 0)
            return;
        const { gl, depthProgram, patch } = this;
        depthProgram.use();
        gl.uniformMatrix4fv(depthProgram.uniform('u_viewProjection'), false, input.camera.viewProjectionMatrix);
        gl.uniform1i(depthProgram.uniform('u_heightMap'), TERRAIN_HEIGHT_TEXTURE_UNIT);
        gl.colorMask(false, false, false, false);
        patch.bind();
        for (let i = 0; i < this.preparedCount; i++) {
            const slot = this.prepared[i];
            const gpu = this.resources.resolve(slot.terrain);
            gl.uniformMatrix4fv(depthProgram.uniform('u_model'), false, slot.entity.worldMatrix);
            bindTerrainGeometryUniforms(gl, depthProgram, slot.terrain);
            gl.activeTexture(gl.TEXTURE0 + TERRAIN_HEIGHT_TEXTURE_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, gpu.heights.texture);
            this.drawBatches(slot, false);
        }
        patch.unbind();
        gl.colorMask(true, true, true, true);
    }
    render(input: TerrainPassInput): void {
        if (this.preparedCount === 0)
            return;
        const { gl, program, patch, material } = this;
        program.use();
        bindSceneLightingUniforms(gl, program, input);
        material.bindSamplers(program);
        gl.uniform1i(program.uniform('u_cacheAlbedo'), TERRAIN_CACHE_ALBEDO_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_cacheNormal'), TERRAIN_CACHE_NORMAL_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_cachePages'), TERRAIN_CACHE_PAGES_TEXTURE_UNIT);
        gl.depthMask(false);
        patch.bind();
        for (let i = 0; i < this.preparedCount; i++)
            this.draw(this.prepared[i], input);
        patch.unbind();
        gl.depthMask(true);
        material.unbindArrays();
        this.unbindCache();
    }
    private draw(slot: PreparedTerrain, input: TerrainPassInput): void {
        const { gl, program } = this;
        const { entity, terrain } = slot;
        const gpu = this.resources.resolve(terrain);
        gl.uniformMatrix4fv(program.uniform('u_model'), false, entity.worldMatrix);
        gl.uniformMatrix3fv(program.uniform('u_normalMatrix'), false, slot.normalMatrix);
        gl.uniform1f(program.uniform('u_receiveShadows'), entity.receiveShadows ? 1 : 0);
        gl.uniform1f(program.uniform('u_outline'), input.selection !== null && input.selection.has(entity.id) ? 1 : 0);
        this.material.bind(program, terrain, gpu);
        const { shading } = terrain;
        const blendStart = Math.max(shading.distanceBlendStart, 0);
        gl.uniform2f(program.uniform('u_distanceBlend'), blendStart, Math.max(shading.distanceBlendEnd, blendStart + 0.5));
        this.bindCache(terrain);
        const brush = input.brush && input.brush.entityId === entity.id ? input.brush : null;
        gl.uniform1f(program.uniform('u_brushEnabled'), brush ? 1 : 0);
        if (brush) {
            gl.uniform4f(program.uniform('u_brush'), brush.x, brush.z, brush.radius, brush.innerRadius);
            gl.uniform3fv(program.uniform('u_brushColor'), brush.color);
        }
        this.drawBatches(slot, true);
    }
    private bindCache(terrain: Terrain): void {
        const { gl, program } = this;
        const cache = this.cache.binding(terrain);
        gl.uniform1f(program.uniform('u_cacheEnabled'), cache ? 1 : 0);
        if (!cache)
            return;
        gl.uniform4f(program.uniform('u_cache'), cache.ringCount, cache.usableRadius, cache.texelsPerMeter, cache.tilesPerSide);
        gl.uniform2f(program.uniform('u_cacheCenter'), cache.center[0], cache.center[2]);
        gl.uniform4fv(program.uniform('u_cacheLevels[0]'), cache.levelParams);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_CACHE_ALBEDO_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache.albedo);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_CACHE_NORMAL_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache.normal);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_CACHE_PAGES_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache.pages);
    }
    private unbindCache(): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_CACHE_ALBEDO_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_CACHE_NORMAL_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_CACHE_PAGES_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    private drawBatches(slot: PreparedTerrain, countTriangles: boolean): void {
        const { patch, instances } = this;
        for (let i = 0; i < slot.batchCount; i++) {
            const batch = slot.batches[i];
            const triangles = patch.draw(batch.level, batch.stitchMask, instances, batch.firstInstance, batch.count);
            if (countTriangles)
                this.stats.triangles += triangles;
            this.stats.drawCalls++;
        }
    }
    private acquirePrepared(entity: Entity, terrain: Terrain): PreparedTerrain {
        let slot = this.prepared[this.preparedCount];
        if (!slot) {
            slot = { entity, terrain, normalMatrix: mat3.create(), batches: [], batchCount: 0 };
            this.prepared[this.preparedCount] = slot;
        }
        else {
            slot.entity = entity;
            slot.terrain = terrain;
        }
        return slot;
    }
    private copyBatches(slot: PreparedTerrain, batches: readonly TerrainTileBatch[]): void {
        slot.batchCount = batches.length;
        for (let i = 0; i < batches.length; i++) {
            const source = batches[i];
            const target = slot.batches[i];
            if (!target) {
                slot.batches[i] = { level: source.level, stitchMask: source.stitchMask, firstInstance: source.firstInstance, count: source.count };
            }
            else {
                target.level = source.level;
                target.stitchMask = source.stitchMask;
                target.firstInstance = source.firstInstance;
                target.count = source.count;
            }
        }
    }
    dispose(): void {
        this.program.dispose();
        this.depthProgram.dispose();
        this.instances.dispose();
    }
}
