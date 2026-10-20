import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER } from '@/engine/renderer/shaders/terrain.glsl';
import { bindSceneLightingUniforms, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { TerrainGpuCache } from '@/engine/renderer/terrain/terrain-gpu-cache';
import { TERRAIN_TILE_INSTANCE_LAYOUT, type TerrainPatchGeometry } from '@/engine/renderer/terrain/terrain-patch-geometry';
import { TerrainTileSelector, type TerrainTileStats } from '@/engine/renderer/terrain/terrain-tile-selector';
import { TERRAIN_ALBEDO_TEXTURE_UNIT, TERRAIN_HEIGHT_TEXTURE_UNIT, TERRAIN_NORMAL_TEXTURE_UNIT, TERRAIN_ORMH_TEXTURE_UNIT, TERRAIN_SPLAT0_TEXTURE_UNIT, TERRAIN_SPLAT1_TEXTURE_UNIT, } from '@/engine/renderer/terrain/terrain-texture-units';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import type { Entity } from '@/engine/core/scene/entity';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
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
const FALLBACK_TILING = 4;
export class TerrainPass {
    readonly stats: TerrainPassStats;
    private readonly program: ShaderProgram;
    private readonly selector = new TerrainTileSelector();
    private readonly instances: InstanceBuffer;
    private readonly normalMatrix = mat3.create();
    private readonly layerParams = new Float32Array(MAX_TERRAIN_LAYERS * 4);
    private readonly layerTints = new Float32Array(MAX_TERRAIN_LAYERS * 3);
    constructor(private readonly gl: GL, private readonly patch: TerrainPatchGeometry, private readonly resources: TerrainGpuCache, defines: ShaderDefines = {}) {
        this.program = new ShaderProgram(gl, TERRAIN_VERTEX_SHADER, withDefines(TERRAIN_FRAGMENT_SHADER, defines));
        this.instances = new InstanceBuffer(gl, TERRAIN_TILE_INSTANCE_LAYOUT);
        this.stats = { drawCalls: 0, triangles: 0, tiles: 0, drawn: 0, perLevel: this.selector.stats.perLevel };
    }
    render(terrains: readonly Entity[], input: TerrainPassInput): void {
        const { gl, program, selector, patch } = this;
        this.stats.drawCalls = 0;
        this.stats.triangles = 0;
        selector.beginFrame();
        this.stats.tiles = 0;
        this.stats.drawn = 0;
        if (terrains.length === 0)
            return;
        program.use();
        bindSceneLightingUniforms(gl, program, input);
        gl.uniform1i(program.uniform('u_heightMap'), TERRAIN_HEIGHT_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_splat0'), TERRAIN_SPLAT0_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_splat1'), TERRAIN_SPLAT1_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_albedoArray'), TERRAIN_ALBEDO_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_normalArray'), TERRAIN_NORMAL_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_ormhArray'), TERRAIN_ORMH_TEXTURE_UNIT);
        patch.bind();
        for (const entity of terrains) {
            if (entity.terrain)
                this.draw(entity, entity.terrain, input);
        }
        patch.unbind();
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_ALBEDO_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_NORMAL_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_ORMH_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        this.stats.tiles = selector.stats.tiles;
        this.stats.drawn = selector.stats.drawn;
    }
    private draw(entity: Entity, terrain: Terrain, input: TerrainPassInput): void {
        const { gl, program, selector, instances, patch } = this;
        if (!mat4.normalMatrix(this.normalMatrix, entity.worldMatrix))
            return;
        instances.begin();
        selector.selectForCamera(entity, terrain, input.frustum, input.camera.position, input.pixelScale, input.lod, instances);
        if (selector.batches.length === 0)
            return;
        instances.upload();
        const gpu = this.resources.resolve(terrain);
        gl.uniformMatrix4fv(program.uniform('u_model'), false, entity.worldMatrix);
        gl.uniformMatrix3fv(program.uniform('u_normalMatrix'), false, this.normalMatrix);
        gl.uniform1f(program.uniform('u_receiveShadows'), entity.receiveShadows ? 1 : 0);
        gl.uniform1f(program.uniform('u_outline'), entity.id === input.selectedId ? 1 : 0);
        gl.uniform1f(program.uniform('u_halfSize'), terrain.halfSize);
        gl.uniform1f(program.uniform('u_cellSize'), terrain.cellSize);
        gl.uniform1i(program.uniform('u_lastSample'), terrain.resolution - 1);
        gl.uniform1f(program.uniform('u_splatResolution'), terrain.splat.resolution);
        const { shading } = terrain;
        gl.uniform1f(program.uniform('u_heightBlendDepth'), Math.max(shading.heightBlendDepth, 0.01));
        gl.uniform2f(program.uniform('u_triplanar'), shading.triplanarStart, Math.max(shading.triplanarRange, 0.01));
        gl.uniform2f(program.uniform('u_macro'), shading.macroVariation, 1 / Math.max(shading.macroScale, 0.1));
        const blendStart = Math.max(shading.distanceBlendStart, 0);
        gl.uniform3f(program.uniform('u_distance'), blendStart, Math.max(shading.distanceBlendEnd, blendStart + 0.5), 1 / Math.max(shading.distanceTiling, 1));
        this.bindLayers(terrain, gpu.layerCount);
        const brush = input.brush && input.brush.entityId === entity.id ? input.brush : null;
        gl.uniform1f(program.uniform('u_brushEnabled'), brush ? 1 : 0);
        if (brush) {
            gl.uniform4f(program.uniform('u_brush'), brush.x, brush.z, brush.radius, brush.innerRadius);
            gl.uniform3fv(program.uniform('u_brushColor'), brush.color);
        }
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_HEIGHT_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, gpu.heights.texture);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_SPLAT0_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, gpu.splat[0]);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_SPLAT1_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, gpu.splat[1]);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_ALBEDO_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, gpu.albedoArray);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_NORMAL_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, gpu.normalArray);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_ORMH_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, gpu.ormhArray);
        for (const batch of selector.batches) {
            this.stats.triangles += patch.draw(batch.level, batch.stitchMask, instances, batch.firstInstance, batch.count);
            this.stats.drawCalls++;
        }
    }
    private bindLayers(terrain: Terrain, sliceCount: number): void {
        const { gl, program, layerParams, layerTints } = this;
        const { layers } = terrain;
        for (let i = 0; i < MAX_TERRAIN_LAYERS; i++) {
            const layer = layers[i];
            layerParams[i * 4] = 1 / Math.max(layer?.tiling ?? FALLBACK_TILING, 0.01);
            layerParams[i * 4 + 1] = layer?.normalStrength ?? 1;
            layerParams[i * 4 + 2] = layer?.roughness ?? 1;
            layerParams[i * 4 + 3] = 0;
            layerTints[i * 3] = layer?.tint[0] ?? 1;
            layerTints[i * 3 + 1] = layer?.tint[1] ?? 1;
            layerTints[i * 3 + 2] = layer?.tint[2] ?? 1;
        }
        gl.uniform1i(program.uniform('u_layerCount'), layers.length > 0 ? layers.length : sliceCount);
        gl.uniform4fv(program.uniform('u_layerParams[0]'), layerParams);
        gl.uniform3fv(program.uniform('u_layerTint[0]'), layerTints);
    }
    dispose(): void {
        this.program.dispose();
        this.instances.dispose();
    }
}
