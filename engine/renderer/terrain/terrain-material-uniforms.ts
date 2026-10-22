import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
import { materialSupportsGrass } from '@/engine/terrain/foliage/grass-placement';
import type { TerrainGpuResources } from './terrain-gpu-cache';
import { TERRAIN_ALBEDO_TEXTURE_UNIT, TERRAIN_GRASS_TEXTURE_UNIT, TERRAIN_HEIGHT_TEXTURE_UNIT, TERRAIN_NORMAL_TEXTURE_UNIT, TERRAIN_ORMH_TEXTURE_UNIT, TERRAIN_SPLAT0_TEXTURE_UNIT, TERRAIN_SPLAT1_TEXTURE_UNIT, } from './terrain-texture-units';
const FALLBACK_TILING = 4;
const GRASS_SHADE_FULL_DENSITY = 150;
const GRASS_SHADE_STRENGTH = 0.85;
export function bindTerrainGeometryUniforms(gl: GL, program: ShaderProgram, terrain: Terrain): void {
    gl.uniform1f(program.uniform('u_halfSize'), terrain.halfSize);
    gl.uniform1f(program.uniform('u_cellSize'), terrain.cellSize);
    gl.uniform1i(program.uniform('u_lastSample'), terrain.resolution - 1);
}
export class TerrainMaterialUniforms {
    private readonly layerParams = new Float32Array(MAX_TERRAIN_LAYERS * 4);
    private readonly layerTints = new Float32Array(MAX_TERRAIN_LAYERS * 3);
    constructor(private readonly gl: GL) { }
    bindSamplers(program: ShaderProgram): void {
        const { gl } = this;
        gl.uniform1i(program.uniform('u_heightMap'), TERRAIN_HEIGHT_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_splat0'), TERRAIN_SPLAT0_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_splat1'), TERRAIN_SPLAT1_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_albedoArray'), TERRAIN_ALBEDO_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_normalArray'), TERRAIN_NORMAL_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_ormhArray'), TERRAIN_ORMH_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_grassMap'), TERRAIN_GRASS_TEXTURE_UNIT);
    }
    bind(program: ShaderProgram, terrain: Terrain, gpu: TerrainGpuResources): void {
        const { gl } = this;
        bindTerrainGeometryUniforms(gl, program, terrain);
        gl.uniform1f(program.uniform('u_splatResolution'), terrain.splat.resolution);
        const { shading } = terrain;
        gl.uniform1f(program.uniform('u_heightBlendDepth'), Math.max(shading.heightBlendDepth, 0.01));
        gl.uniform2f(program.uniform('u_triplanar'), shading.triplanarStart, Math.max(shading.triplanarRange, 0.01));
        gl.uniform2f(program.uniform('u_macro'), shading.macroVariation, 1 / Math.max(shading.macroScale, 0.1));
        gl.uniform1f(program.uniform('u_farTiling'), 1 / Math.max(shading.distanceTiling, 1));
        this.bindLayers(program, terrain, gpu.layerCount);
        const { grass } = terrain;
        const grassShade = grass.enabled ? Math.min(grass.density / GRASS_SHADE_FULL_DENSITY, 1) * GRASS_SHADE_STRENGTH : 0;
        gl.uniform2f(program.uniform('u_grassMapInfo'), terrain.grassMap.resolution, grassShade);
        gl.uniform3f(program.uniform('u_grassShade'), 0.3 + grass.baseColor[0] * 2.5, 0.34 + grass.baseColor[1] * 3.0, 0.22 + grass.baseColor[2] * 2.5);
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
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_GRASS_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, gpu.grass);
    }
    unbindArrays(): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_ALBEDO_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_NORMAL_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_ORMH_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    private bindLayers(program: ShaderProgram, terrain: Terrain, sliceCount: number): void {
        const { gl, layerParams, layerTints } = this;
        const { layers } = terrain;
        for (let i = 0; i < MAX_TERRAIN_LAYERS; i++) {
            const layer = layers[i];
            layerParams[i * 4] = 1 / Math.max(layer?.tiling ?? FALLBACK_TILING, 0.01);
            layerParams[i * 4 + 1] = layer?.normalStrength ?? 1;
            layerParams[i * 4 + 2] = layer?.roughness ?? 1;
            layerParams[i * 4 + 3] = layer && materialSupportsGrass(layer.material) ? 1 : 0;
            layerTints[i * 3] = layer?.tint[0] ?? 1;
            layerTints[i * 3 + 1] = layer?.tint[1] ?? 1;
            layerTints[i * 3 + 2] = layer?.tint[2] ?? 1;
        }
        gl.uniform1i(program.uniform('u_layerCount'), layers.length > 0 ? layers.length : sliceCount);
        gl.uniform4fv(program.uniform('u_layerParams[0]'), layerParams);
        gl.uniform3fv(program.uniform('u_layerTint[0]'), layerTints);
    }
}
