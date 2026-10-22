import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { MATERIAL_MAP_SLOTS, type MaterialState } from '@/engine/renderer/batching/material-state';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { MYRIAD_RESOLVE_FRAGMENT_SHADER } from '../shaders/myriad-resolve.glsl';
import type { EntryList, InstanceTable } from './frame-data';
import type { GeometryPool } from './geometry-pool';
import type { VisibilityBuffer } from './visibility-buffer';
interface MapBinding {
    uniform: string;
    fallback: 'white' | 'flatNormal';
}
const MAP_BINDINGS: readonly MapBinding[] = [
    { uniform: 'u_baseColorMap', fallback: 'white' },
    { uniform: 'u_metallicRoughnessMap', fallback: 'white' },
    { uniform: 'u_normalMap', fallback: 'flatNormal' },
    { uniform: 'u_occlusionMap', fallback: 'white' },
    { uniform: 'u_emissiveMap', fallback: 'white' },
];
const FIRST_DATA_UNIT = FIRST_PASS_TEXTURE_UNIT + MAP_BINDINGS.length;
const DATA_SAMPLERS = ['u_visBuffer', 'u_list', 'u_instances', 'u_clusterInfo', 'u_clusterBounds', 'u_triangles', 'u_vertices'] as const;
export interface ResolveInput {
    lighting: SceneLightingInput;
    states: readonly MaterialState[];
    rects: Float32Array | null;
    visibility: VisibilityBuffer;
    list: EntryList;
    instances: InstanceTable;
    pool: GeometryPool;
    debugView: number;
    wireframe: boolean;
}
export class MaterialResolvePass {
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly textures: GpuTextureCache, defines: ShaderDefines) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(MYRIAD_RESOLVE_FRAGMENT_SHADER, defines));
    }
    run(input: ResolveInput): number {
        const { gl, program } = this;
        if (input.states.length === 0)
            return 0;
        program.use();
        bindSceneLightingUniforms(gl, program, input.lighting);
        const { visibility, pool, rects } = input;
        const data = [
            visibility.ids,
            input.list.texture.texture,
            input.instances.texture.texture,
            pool.clusterInfo.texture,
            pool.clusterBounds.texture,
            pool.triangles.texture,
            pool.vertices.texture,
        ];
        for (let i = 0; i < data.length; i++) {
            gl.activeTexture(gl.TEXTURE0 + FIRST_DATA_UNIT + i);
            gl.bindTexture(gl.TEXTURE_2D, data[i]);
            gl.uniform1i(program.uniform(DATA_SAMPLERS[i]), FIRST_DATA_UNIT + i);
        }
        for (let i = 0; i < MAP_BINDINGS.length; i++)
            gl.uniform1i(program.uniform(MAP_BINDINGS[i].uniform), FIRST_PASS_TEXTURE_UNIT + i);
        gl.uniform2f(program.uniform('u_screenSize'), visibility.width, visibility.height);
        gl.uniform1i(program.uniform('u_debugView'), input.debugView);
        gl.uniform1i(program.uniform('u_wireframe'), input.wireframe ? 1 : 0);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        if (rects)
            gl.enable(gl.SCISSOR_TEST);
        let drawCalls = 0;
        for (let i = 0; i < input.states.length; i++) {
            if (rects && !this.applyScissor(rects, i, visibility.width, visibility.height))
                continue;
            this.bindMaps(input.states[i]);
            gl.uniform1ui(program.uniform('u_stateId'), input.states[i].id);
            this.triangle.draw();
            drawCalls++;
        }
        if (rects)
            gl.disable(gl.SCISSOR_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        return drawCalls;
    }
    private applyScissor(rects: Float32Array, index: number, width: number, height: number): boolean {
        const offset = index * 4;
        const x0 = Math.max(0, Math.floor((rects[offset] * 0.5 + 0.5) * width));
        const y0 = Math.max(0, Math.floor((rects[offset + 1] * 0.5 + 0.5) * height));
        const x1 = Math.min(width, Math.ceil((rects[offset + 2] * 0.5 + 0.5) * width));
        const y1 = Math.min(height, Math.ceil((rects[offset + 3] * 0.5 + 0.5) * height));
        if (x1 <= x0 || y1 <= y0)
            return false;
        this.gl.scissor(x0, y0, x1 - x0, y1 - y0);
        return true;
    }
    private bindMaps(state: MaterialState): void {
        const { gl, program, textures } = this;
        let mask = 0;
        for (let i = 0; i < MATERIAL_MAP_SLOTS.length; i++) {
            const texture = state.textures[i];
            const handle = texture ? textures.resolve(texture) : null;
            gl.activeTexture(gl.TEXTURE0 + FIRST_PASS_TEXTURE_UNIT + i);
            gl.bindTexture(gl.TEXTURE_2D, handle ?? textures[MAP_BINDINGS[i].fallback]);
            if (handle)
                mask |= 1 << i;
        }
        gl.uniform1i(program.uniform('u_textureMask'), mask);
    }
    dispose(): void {
        this.program.dispose();
    }
}
