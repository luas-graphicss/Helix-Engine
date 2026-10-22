import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import { JOINT_MATRICES_TEXTURE_UNIT, type GpuSkinCache } from '@/engine/renderer/gl/gpu-skin-cache';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/mesh.glsl';
import { DEPTH_MASKED_FRAGMENT_SHADER, DEPTH_ONLY_FRAGMENT_SHADER } from '@/engine/renderer/shaders/depth-prepass.glsl';
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
    private readonly skinnedProgram: ShaderProgram;
    private readonly depthProgram: ShaderProgram;
    private readonly depthMaskedProgram: ShaderProgram;
    private readonly depthSkinnedProgram: ShaderProgram;
    private readonly batcher = new MeshBatcher();
    private boundProgram: ShaderProgram | null = null;
    private boundState: MaterialState | null = null;
    private input: MeshPassInput | null = null;
    private instances: InstanceBuffer | null = null;
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly textures: GpuTextureCache, private readonly skins: GpuSkinCache, defines: ShaderDefines = {}) {
        const fragment = withDefines(MESH_FRAGMENT_SHADER, defines);
        const skinnedVertex = withDefines(MESH_VERTEX_SHADER, { SKINNED: true });
        this.program = new ShaderProgram(gl, MESH_VERTEX_SHADER, fragment);
        this.skinnedProgram = new ShaderProgram(gl, skinnedVertex, fragment);
        this.depthProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, DEPTH_ONLY_FRAGMENT_SHADER);
        this.depthMaskedProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, DEPTH_MASKED_FRAGMENT_SHADER);
        this.depthSkinnedProgram = new ShaderProgram(gl, skinnedVertex, DEPTH_ONLY_FRAGMENT_SHADER);
    }
    prepare(visible: VisibleSet, input: MeshPassInput, instances: InstanceBuffer, resolveMesh: MeshResolver): void {
        const { batcher } = this;
        batcher.build(visible, instances, input.selection, resolveMesh);
        this.stats.drawCalls = 0;
        this.stats.triangles = batcher.stats.triangles;
        this.stats.instances = batcher.stats.instances;
        this.stats.batches = batcher.stats.batches;
        this.input = input;
        this.instances = instances;
    }
    renderDepth(): void {
        const { gl, batcher, input, instances } = this;
        if (!input || !instances)
            return;
        if (batcher.opaque.length === 0 && batcher.skinned.length === 0)
            return;
        gl.colorMask(false, false, false, false);
        const viewProjection = input.camera.viewProjectionMatrix;
        let program: ShaderProgram | null = null;
        let doubleSided = false;
        for (const batch of batcher.opaque) {
            const masked = batch.state.alphaMode === 'mask';
            const wanted = masked ? this.depthMaskedProgram : this.depthProgram;
            if (program !== wanted) {
                program = wanted;
                program.use();
                gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, viewProjection);
                if (masked)
                    gl.uniform1i(program.uniform('u_baseColorMap'), MATERIAL_TEXTURE_UNIT);
            }
            if (batch.state.doubleSided !== doubleSided) {
                doubleSided = batch.state.doubleSided;
                if (doubleSided)
                    gl.disable(gl.CULL_FACE);
                else
                    gl.enable(gl.CULL_FACE);
            }
            if (masked) {
                const texture = batch.state.textures[0];
                const handle = texture ? this.textures.resolve(texture) : null;
                gl.activeTexture(gl.TEXTURE0 + MATERIAL_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, handle ?? this.textures.white);
                gl.uniform1i(program.uniform('u_textureMask'), handle ? 1 : 0);
            }
            this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.count);
            this.stats.drawCalls++;
        }
        if (batcher.skinned.length > 0) {
            const skinned = this.depthSkinnedProgram;
            skinned.use();
            gl.uniformMatrix4fv(skinned.uniform('u_viewProjection'), false, viewProjection);
            gl.uniform1i(skinned.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
            for (const batch of batcher.skinned) {
                const { skin } = batch.items[0].visible.entity;
                if (!skin)
                    continue;
                if (batch.state.doubleSided !== doubleSided) {
                    doubleSided = batch.state.doubleSided;
                    if (doubleSided)
                        gl.disable(gl.CULL_FACE);
                    else
                        gl.enable(gl.CULL_FACE);
                }
                gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, this.skins.resolve(skin));
                this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.count);
                this.stats.drawCalls++;
            }
        }
        gl.colorMask(true, true, true, true);
        gl.enable(gl.CULL_FACE);
    }
    renderOpaque(): void {
        const { gl, batcher, input, instances } = this;
        if (!input || !instances)
            return;
        gl.depthMask(false);
        if (batcher.opaque.length > 0) {
            this.bindFrame(this.program, input);
            for (const batch of batcher.opaque)
                this.drawBatch(batch, instances);
        }
        if (batcher.skinned.length > 0) {
            this.bindFrame(this.skinnedProgram, input);
            gl.uniform1i(this.skinnedProgram.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
            for (const batch of batcher.skinned) {
                const { skin } = batch.items[0].visible.entity;
                if (!skin)
                    continue;
                const texture = this.skins.resolve(skin);
                gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                this.drawBatch(batch, instances);
            }
        }
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
    }
    renderTransparent(): void {
        const { gl, batcher, input, instances } = this;
        if (batcher.transparent.length === 0 || !input || !instances)
            return;
        this.bindFrame(this.program, input);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (const batch of batcher.transparent)
            this.drawBatch(batch, instances);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
    private bindFrame(program: ShaderProgram, input: MeshPassInput): void {
        const { gl } = this;
        program.use();
        bindSceneLightingUniforms(gl, program, input);
        for (let i = 0; i < TEXTURE_BINDINGS.length; i++) {
            gl.uniform1i(program.uniform(TEXTURE_BINDINGS[i].uniform), MATERIAL_TEXTURE_UNIT + i);
        }
        this.boundProgram = program;
        this.boundState = null;
    }
    private drawBatch(batch: MeshBatch, instances: InstanceBuffer): void {
        if (batch.state !== this.boundState)
            this.bindState(batch.state);
        this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.count);
        this.stats.drawCalls++;
    }
    private bindState(state: MaterialState): void {
        const { gl, textures } = this;
        const program = this.boundProgram as ShaderProgram;
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
        this.skinnedProgram.dispose();
        this.depthProgram.dispose();
        this.depthMaskedProgram.dispose();
        this.depthSkinnedProgram.dispose();
    }
}
