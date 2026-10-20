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
const DATA_SAMPLERS = ['u_visBuffer', 'u_depth', 'u_list', 'u_instances', 'u_clusterInfo', 'u_clusterBounds', 'u_triangles', 'u_vertices'] as const;
export interface ResolveInput {
    lighting: SceneLightingInput;
    states: readonly MaterialState[];
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
        const { visibility, pool } = input;
        const data = [
            visibility.ids,
            visibility.depth,
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
        for (const state of input.states) {
            this.bindMaps(state);
            gl.uniform1ui(program.uniform('u_stateId'), state.id);
            this.triangle.draw();
        }
        gl.enable(gl.CULL_FACE);
        return input.states.length;
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
