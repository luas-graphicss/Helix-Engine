import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { SceneColorCapture, type PixelRect } from '@/engine/renderer/gl/scene-color-capture';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER } from '@/engine/renderer/shaders/water.glsl';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { TerrainGpuCache } from '@/engine/renderer/terrain/terrain-gpu-cache';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import type { Entity } from '@/engine/core/scene/entity';
import * as aabb from '@/engine/core/math/aabb';
import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { waterGridSegments } from '@/engine/terrain/water/gerstner-waves';
import type { WaterFoamSettings } from '@/engine/terrain/water/water-foam-settings';
export interface WaterPassInput extends SceneLightingInput {
    frustum: Frustum | null;
    elapsedSeconds: number;
    width: number;
    height: number;
}
export interface WaterPassStats {
    drawCalls: number;
    triangles: number;
}
const HEIGHT_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT;
const SKY_VIEW_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT + 1;
const SCENE_COLOR_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT + 2;
interface WaterGrid {
    vao: WebGLVertexArrayObject;
    vertexBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;
    indexCount: number;
}
export class WaterPass {
    readonly stats: WaterPassStats = { drawCalls: 0, triangles: 0 };
    private readonly program: ShaderProgram;
    private readonly sceneColor: SceneColorCapture;
    private readonly grids = new Map<number, WaterGrid>();
    private readonly normalMatrix = mat3.create();
    private readonly inverseWorld = mat4.create();
    private readonly sunDirectionLocal = vec3.create();
    private readonly localBox = aabb.create();
    private readonly worldBox = aabb.create();
    private readonly visible: Entity[] = [];
    private readonly captureRect: PixelRect = { x: 0, y: 0, width: 0, height: 0 };
    constructor(private readonly gl: GL, private readonly terrainGpu: TerrainGpuCache, defines: ShaderDefines = {}) {
        this.program = new ShaderProgram(gl, WATER_VERTEX_SHADER, withDefines(WATER_FRAGMENT_SHADER, defines));
        this.sceneColor = new SceneColorCapture(gl);
    }
    render(terrains: readonly Entity[], input: WaterPassInput): void {
        const { gl, program, stats, visible } = this;
        stats.drawCalls = 0;
        stats.triangles = 0;
        visible.length = 0;
        const rect = this.captureRect;
        rect.x = input.width;
        rect.y = input.height;
        rect.width = 0;
        rect.height = 0;
        for (const entity of terrains) {
            const terrain = entity.terrain;
            if (!terrain || !terrain.water.enabled || !this.isVisible(entity, terrain, input))
                continue;
            visible.push(entity);
            this.growCaptureRect(input);
        }
        if (visible.length === 0)
            return;
        gl.activeTexture(gl.TEXTURE0 + SCENE_COLOR_TEXTURE_UNIT);
        this.sceneColor.capture(input.width, input.height, rect);
        program.use();
        bindSceneLightingUniforms(gl, program, input);
        gl.uniform1i(program.uniform('u_heightMap'), HEIGHT_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_skyViewLut'), SKY_VIEW_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_sceneColor'), SCENE_COLOR_TEXTURE_UNIT);
        gl.uniform1f(program.uniform('u_skyViewEnabled'), input.sky.skyViewValid ? 1 : 0);
        gl.uniform2f(program.uniform('u_resolution'), input.width, input.height);
        gl.activeTexture(gl.TEXTURE0 + SKY_VIEW_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, input.sky.skyViewLut);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        for (const entity of visible)
            this.draw(entity, entity.terrain as Terrain, input);
        gl.bindVertexArray(null);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
    private isVisible(entity: Entity, terrain: Terrain, input: WaterPassInput): boolean {
        const { water } = terrain;
        if (water.level + water.waveHeight < terrain.tiles.minHeight)
            return false;
        const { localBox, worldBox } = this;
        const half = terrain.halfSize;
        localBox.min[0] = -half;
        localBox.min[1] = water.level - water.waveHeight;
        localBox.min[2] = -half;
        localBox.max[0] = half;
        localBox.max[1] = water.level + water.waveHeight;
        localBox.max[2] = half;
        aabb.transform(worldBox, localBox, entity.worldMatrix);
        return !input.frustum || input.frustum.intersectsAabb(worldBox);
    }
    private growCaptureRect(input: WaterPassInput): void {
        const { worldBox, captureRect } = this;
        const m = input.camera.viewProjectionMatrix;
        const { width, height } = input;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let corner = 0; corner < 8; corner++) {
            const x = corner & 1 ? worldBox.max[0] : worldBox.min[0];
            const y = corner & 2 ? worldBox.max[1] : worldBox.min[1];
            const z = corner & 4 ? worldBox.max[2] : worldBox.min[2];
            const w = m[3] * x + m[7] * y + m[11] * z + m[15];
            if (w <= 1e-5) {
                minX = 0;
                minY = 0;
                maxX = width;
                maxY = height;
                break;
            }
            const px = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * width;
            const py = ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5 + 0.5) * height;
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
        }
        const margin = 0.08 * Math.max(width, height);
        const x0 = Math.min(captureRect.x, Math.max(minX - margin, 0));
        const y0 = Math.min(captureRect.y, Math.max(minY - margin, 0));
        const x1 = Math.max(captureRect.x + captureRect.width, Math.min(maxX + margin, width));
        const y1 = Math.max(captureRect.y + captureRect.height, Math.min(maxY + margin, height));
        captureRect.x = x0;
        captureRect.y = y0;
        captureRect.width = Math.max(x1 - x0, 0);
        captureRect.height = Math.max(y1 - y0, 0);
    }
    private draw(entity: Entity, terrain: Terrain, input: WaterPassInput): void {
        const { gl, program } = this;
        if (!mat4.normalMatrix(this.normalMatrix, entity.worldMatrix) || !mat4.invert(this.inverseWorld, entity.worldMatrix))
            return;
        const gpu = this.terrainGpu.resolve(terrain);
        const segments = waterGridSegments(terrain.size);
        const grid = this.resolveGrid(segments);
        const { water } = terrain;
        const direction = degToRad(water.waveDirection);
        vec3.normalize(this.sunDirectionLocal, mat4.transformDirection(this.sunDirectionLocal, this.inverseWorld, input.lighting.sunDirection));
        gl.uniformMatrix4fv(program.uniform('u_model'), false, entity.worldMatrix);
        gl.uniformMatrix3fv(program.uniform('u_normalMatrix'), false, this.normalMatrix);
        gl.uniform1f(program.uniform('u_halfSize'), terrain.halfSize);
        gl.uniform1f(program.uniform('u_cellSize'), terrain.cellSize);
        gl.uniform1i(program.uniform('u_lastSample'), terrain.resolution - 1);
        gl.uniform1f(program.uniform('u_level'), water.level);
        gl.uniform1f(program.uniform('u_gridCell'), terrain.size / segments);
        gl.uniform4f(program.uniform('u_wave'), Math.max(water.waveHeight, 0), Math.max(water.waveLength, 0.5), input.elapsedSeconds * water.waveSpeed, clamp(water.choppiness, 0, 1));
        gl.uniform2f(program.uniform('u_waveDirection'), Math.cos(direction), Math.sin(direction));
        gl.uniform3fv(program.uniform('u_shallowColor'), water.shallowColor);
        gl.uniform3fv(program.uniform('u_deepColor'), water.deepColor);
        gl.uniform3f(program.uniform('u_surface'), water.clarity, clamp(water.reflectivity, 0, 1), clamp(water.roughness, 0.02, 1));
        gl.uniform4f(program.uniform('u_ripple'), clamp(water.ripples, 0, 2), input.elapsedSeconds * Math.max(water.waveSpeed, 0.15), water.waveHeight, Math.max(water.waveLength, 0.5));
        gl.uniform3f(program.uniform('u_optics'), clamp(water.refraction, 0, 1), clamp(water.caustics, 0, 1), clamp(water.subsurface, 0, 1));
        this.bindFoam(water.foam, water.waveSpeed);
        gl.uniform3fv(program.uniform('u_sunDirectionLocal'), this.sunDirectionLocal);
        gl.uniform1f(program.uniform('u_receiveShadows'), entity.receiveShadows ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0 + HEIGHT_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, gpu.heights.texture);
        gl.bindVertexArray(grid.vao);
        gl.drawElements(gl.TRIANGLES, grid.indexCount, gl.UNSIGNED_INT, 0);
        this.stats.drawCalls++;
        this.stats.triangles += grid.indexCount / 3;
    }
    private bindFoam(foam: WaterFoamSettings, waveSpeed: number): void {
        const { gl, program } = this;
        if (!foam.enabled) {
            gl.uniform4f(program.uniform('u_foam'), 0, 0, 0, 1);
            gl.uniform1f(program.uniform('u_foamPersistence'), 0);
            return;
        }
        const crestThreshold = 0.5 + 0.5 * clamp(foam.crestBias, 0, 1);
        gl.uniform4f(program.uniform('u_foam'), Math.max(foam.shoreWidth, 0), clamp(foam.shoreAmount, 0, 1), clamp(foam.crestAmount, 0, 1), crestThreshold);
        gl.uniform4f(program.uniform('u_foamShape'), Math.max(foam.scale, 0.05), clamp(foam.sharpness, 0, 1), clamp(foam.bubbles, 0, 1), clamp(foam.brightness, 0, 1));
        gl.uniform1f(program.uniform('u_foamPersistence'), Math.max(foam.persistence, 0) * Math.max(waveSpeed, 0));
    }
    private resolveGrid(segments: number): WaterGrid {
        const existing = this.grids.get(segments);
        if (existing)
            return existing;
        const { gl } = this;
        const side = segments + 1;
        const vertices = new Float32Array(side * side * 2);
        for (let z = 0; z < side; z++) {
            for (let x = 0; x < side; x++) {
                const index = (z * side + x) * 2;
                vertices[index] = x / segments;
                vertices[index + 1] = z / segments;
            }
        }
        const indices = new Uint32Array(segments * segments * 6);
        let cursor = 0;
        for (let z = 0; z < segments; z++) {
            for (let x = 0; x < segments; x++) {
                const a = z * side + x;
                const b = a + 1;
                const c = a + side;
                const d = c + 1;
                indices[cursor++] = a;
                indices[cursor++] = c;
                indices[cursor++] = b;
                indices[cursor++] = b;
                indices[cursor++] = c;
                indices[cursor++] = d;
            }
        }
        const vao = gl.createVertexArray();
        const vertexBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();
        if (!vao || !vertexBuffer || !indexBuffer)
            throw new Error('Não foi possível criar a grade da água.');
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        const grid: WaterGrid = { vao, vertexBuffer, indexBuffer, indexCount: indices.length };
        this.grids.set(segments, grid);
        return grid;
    }
    dispose(): void {
        const { gl } = this;
        this.program.dispose();
        this.sceneColor.dispose();
        for (const grid of this.grids.values()) {
            gl.deleteVertexArray(grid.vao);
            gl.deleteBuffer(grid.vertexBuffer);
            gl.deleteBuffer(grid.indexBuffer);
        }
        this.grids.clear();
    }
}
