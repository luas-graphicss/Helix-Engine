import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/mesh.glsl';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { VisibleSet } from '@/engine/renderer/culling/visible-set';
import { MeshBatcher, type MeshBatch, type MeshResolver } from '@/engine/renderer/batching/mesh-batcher';
import { MATERIAL_MAP_SLOTS, type MaterialState } from '@/engine/renderer/batching/material-state';
import type { AlphaMode } from '@/engine/core/scene/material';
const MATERIAL_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT;
const ALPHA_MODE_VALUE: Record<AlphaMode, number> = { opaque: 0, mask: 1, blend: 2 };
interface TextureBinding {
    uniform: string;
    fallback: 'white' | 'flatNormal';
}
const TEXTURE_BINDINGS: readonly TextureBinding[] = [
    { uniform: 'u_baseColorMap', fallback: 'white' },
    { uniform: 'u_metallicRoughnessMap', fallback: 'white' },
    { uniform: 'u_normalMap', fallback: 'flatNormal' },
    { uniform: 'u_occlusionMap', fallback: 'white' },
    { uniform: 'u_emissiveMap', fallback: 'white' },
];
export type MeshPassInput = SceneLightingInput;
export interface MeshPassStats {
    drawCalls: number;
    triangles: number;
    instances: number;
    batches: number;
}
export class MeshPass {
    readonly stats: MeshPassStats = { drawCalls: 0, triangles: 0, instances: 0, batches: 0 };
    private readonly program: ShaderProgram;
    private readonly batcher = new MeshBatcher();
    private boundState: MaterialState | null = null;
    private input: MeshPassInput | null = null;
    private instances: InstanceBuffer | null = null;
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly textures: GpuTextureCache, defines: ShaderDefines = {}) {
        this.program = new ShaderProgram(gl, MESH_VERTEX_SHADER, withDefines(MESH_FRAGMENT_SHADER, defines));
    }
    prepare(visible: VisibleSet, input: MeshPassInput, instances: InstanceBuffer, resolveMesh: MeshResolver): void {
        const { batcher } = this;
        batcher.build(visible, instances, input.selectedId, resolveMesh);
        this.stats.drawCalls = 0;
        this.stats.triangles = batcher.stats.triangles;
        this.stats.instances = batcher.stats.instances;
        this.stats.batches = batcher.stats.batches;
        this.input = input;
        this.instances = instances;
    }
    renderOpaque(): void {
        const { gl, batcher, input, instances } = this;
        if (batcher.opaque.length === 0 || !input || !instances)
            return;
        this.bindFrame(input);
        for (const batch of batcher.opaque)
            this.drawBatch(batch, instances);
        gl.enable(gl.CULL_FACE);
    }
    renderTransparent(): void {
        const { gl, batcher, input, instances } = this;
        if (batcher.transparent.length === 0 || !input || !instances)
            return;
        this.bindFrame(input);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (const batch of batcher.transparent)
            this.drawBatch(batch, instances);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
    private bindFrame(input: MeshPassInput): void {
        const { gl, program } = this;
        program.use();
        bindSceneLightingUniforms(gl, program, input);
        for (let i = 0; i < TEXTURE_BINDINGS.length; i++) {
            gl.uniform1i(program.uniform(TEXTURE_BINDINGS[i].uniform), MATERIAL_TEXTURE_UNIT + i);
        }
        this.boundState = null;
    }
    private drawBatch(batch: MeshBatch, instances: InstanceBuffer): void {
        if (batch.state !== this.boundState)
            this.bindState(batch.state);
        this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.count);
        this.stats.drawCalls++;
    }
    private bindState(state: MaterialState): void {
        const { gl, program, textures } = this;
        const previous = this.boundState;
        this.boundState = state;
        gl.uniform1f(program.uniform('u_alphaMode'), ALPHA_MODE_VALUE[state.alphaMode]);
        if (!previous || previous.doubleSided !== state.doubleSided) {
            if (state.doubleSided)
                gl.disable(gl.CULL_FACE);
            else
                gl.enable(gl.CULL_FACE);
        }
        let mask = 0;
        for (let i = 0; i < MATERIAL_MAP_SLOTS.length; i++) {
            const texture = state.textures[i];
            const handle = texture ? textures.resolve(texture) : null;
            gl.activeTexture(gl.TEXTURE0 + MATERIAL_TEXTURE_UNIT + i);
            gl.bindTexture(gl.TEXTURE_2D, handle ?? textures[TEXTURE_BINDINGS[i].fallback]);
            if (handle)
                mask |= 1 << i;
        }
        gl.uniform1i(program.uniform('u_textureMask'), mask);
    }
    dispose(): void {
        this.program.dispose();
    }
}
