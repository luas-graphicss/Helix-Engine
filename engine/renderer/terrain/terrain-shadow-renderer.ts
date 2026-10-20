import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { TERRAIN_DEPTH_VERTEX_SHADER } from '@/engine/renderer/shaders/terrain-depth.glsl';
import { SHADOW_DEPTH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-depth.glsl';
import { Frustum } from '@/engine/renderer/culling/frustum';
import type { TerrainShadowCaster } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import { maxAxisScale, type Mat4 } from '@/engine/core/math/mat4';
import { TERRAIN_TILE_INSTANCE_LAYOUT, type TerrainPatchGeometry } from './terrain-patch-geometry';
import type { TerrainGpuCache } from './terrain-gpu-cache';
import { shadowLevelForTexel, TerrainTileSelector } from './terrain-tile-selector';
import { TERRAIN_HEIGHT_TEXTURE_UNIT } from './terrain-texture-units';
export class TerrainShadowRenderer {
    readonly stats = { drawCalls: 0, triangles: 0 };
    private readonly program: ShaderProgram;
    private readonly instances: InstanceBuffer;
    private readonly selector = new TerrainTileSelector();
    private readonly frustum = new Frustum();
    private lod: LodSettings = { enabled: true, bias: 0 };
    constructor(private readonly gl: GL, private readonly patch: TerrainPatchGeometry, private readonly resources: TerrainGpuCache) {
        this.program = new ShaderProgram(gl, TERRAIN_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER);
        this.instances = new InstanceBuffer(gl, TERRAIN_TILE_INSTANCE_LAYOUT);
    }
    beginFrame(lod: LodSettings): void {
        this.lod = lod;
        this.stats.drawCalls = 0;
        this.stats.triangles = 0;
    }
    renderCascade(casters: readonly TerrainShadowCaster[], lightViewProjection: Mat4, texelWorldSize: number): void {
        if (casters.length === 0)
            return;
        const { gl, program, patch, instances } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_lightViewProjection'), false, lightViewProjection);
        gl.uniform1i(program.uniform('u_heightMap'), TERRAIN_HEIGHT_TEXTURE_UNIT);
        this.frustum.setFromViewProjection(lightViewProjection);
        patch.bind();
        for (const { entity, terrain } of casters) {
            instances.begin();
            const count = this.selector.selectForLight(entity, terrain, this.frustum, instances);
            if (count === 0)
                continue;
            instances.upload();
            const gpu = this.resources.resolve(terrain);
            const level = shadowLevelForTexel(texelWorldSize, terrain.cellSize * maxAxisScale(entity.worldMatrix), this.lod);
            gl.uniformMatrix4fv(program.uniform('u_model'), false, entity.worldMatrix);
            gl.uniform1f(program.uniform('u_halfSize'), terrain.halfSize);
            gl.uniform1f(program.uniform('u_cellSize'), terrain.cellSize);
            gl.uniform1i(program.uniform('u_lastSample'), terrain.resolution - 1);
            gl.activeTexture(gl.TEXTURE0 + TERRAIN_HEIGHT_TEXTURE_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, gpu.heights.texture);
            this.stats.triangles += patch.draw(level, 0, instances, 0, count);
            this.stats.drawCalls++;
        }
        patch.unbind();
    }
    dispose(): void {
        this.program.dispose();
        this.instances.dispose();
    }
}
