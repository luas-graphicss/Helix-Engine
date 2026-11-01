import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import { JOINT_MATRICES_TEXTURE_UNIT, type GpuSkinCache } from '@/engine/renderer/gl/gpu-skin-cache';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER, MESH_WIREFRAME_FRAGMENT_SHADER } from '@/engine/renderer/shaders/mesh.glsl';
import { DEPTH_MASKED_FRAGMENT_SHADER, DEPTH_ONLY_FRAGMENT_SHADER } from '@/engine/renderer/shaders/depth-prepass.glsl';
import { MESH_SURFACE_PREPASS_FRAGMENT_SHADER } from '@/engine/renderer/reflections/shaders/surface-buffer.glsl';
import { debugViewIndex, type MyriadDebugView } from '@/engine/renderer/myriad/runtime/myriad-settings';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, sceneLightingDefines, type SceneLightingInput, type ShadowSource, } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { VisibleSet } from '@/engine/renderer/culling/visible-set';
import { MeshBatcher, type MeshBatch, type MeshResolver } from '@/engine/renderer/batching/mesh-batcher';
import { MATERIAL_MAP_SLOTS, type MaterialState } from '@/engine/renderer/batching/material-state';
import type { CustomProgram, SurfaceVariant } from '@/engine/renderer/shaders/custom/custom-shader-programs';
import type { AlphaMode } from '@/engine/core/scene/material';
import type { MeshSurfaceShaders } from './mesh-surface-shaders';
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
    animatedShaders: number;
}
export class MeshPass {
    readonly stats: MeshPassStats = { drawCalls: 0, triangles: 0, instances: 0, batches: 0, animatedShaders: 0 };
    private readonly program: ShaderProgram;
    private readonly skinnedProgram: ShaderProgram;
    private readonly transparentProgram: ShaderProgram;
    private readonly depthProgram: ShaderProgram;
    private readonly depthMaskedProgram: ShaderProgram;
    private readonly depthSkinnedProgram: ShaderProgram;
    private readonly surfaceProgram: ShaderProgram;
    private readonly surfaceMaskedProgram: ShaderProgram;
    private readonly surfaceSkinnedProgram: ShaderProgram;
    private readonly wireframeProgram: ShaderProgram;
    private readonly wireframeSkinnedProgram: ShaderProgram;
    private readonly batcher = new MeshBatcher();
    private surface: MeshSurfaceShaders | null = null;
    private boundProgram: ShaderProgram | null = null;
    private boundState: MaterialState | null = null;
    private boundCustom: CustomProgram | null = null;
    private input: MeshPassInput | null = null;
    private instances: InstanceBuffer | null = null;
    private debugView = 0;
    private edges = false;
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly textures: GpuTextureCache, private readonly skins: GpuSkinCache, defines: ShaderDefines = {}) {
        const fragment = withDefines(MESH_FRAGMENT_SHADER, defines);
        const skinnedVertex = withDefines(MESH_VERTEX_SHADER, { SKINNED: true });
        this.program = new ShaderProgram(gl, MESH_VERTEX_SHADER, fragment);
        this.skinnedProgram = new ShaderProgram(gl, skinnedVertex, fragment);
        this.transparentProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, withDefines(MESH_FRAGMENT_SHADER, sceneLightingDefines(defines, 'direct')));
        this.depthProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, DEPTH_ONLY_FRAGMENT_SHADER);
        this.depthMaskedProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, DEPTH_MASKED_FRAGMENT_SHADER);
        this.depthSkinnedProgram = new ShaderProgram(gl, skinnedVertex, DEPTH_ONLY_FRAGMENT_SHADER);
        this.surfaceProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, MESH_SURFACE_PREPASS_FRAGMENT_SHADER);
        this.surfaceMaskedProgram = new ShaderProgram(gl, MESH_VERTEX_SHADER, withDefines(MESH_SURFACE_PREPASS_FRAGMENT_SHADER, { MASKED: true }));
        this.surfaceSkinnedProgram = new ShaderProgram(gl, skinnedVertex, MESH_SURFACE_PREPASS_FRAGMENT_SHADER);
        const wireframe = withDefines(MESH_WIREFRAME_FRAGMENT_SHADER, defines);
        this.wireframeProgram = new ShaderProgram(gl, withDefines(MESH_VERTEX_SHADER, { WIREFRAME: true }), wireframe);
        this.wireframeSkinnedProgram = new ShaderProgram(gl, withDefines(MESH_VERTEX_SHADER, { SKINNED: true, WIREFRAME: true }), wireframe);
    }
    attachSurfaceShaders(surface: MeshSurfaceShaders): void {
        this.surface = surface;
    }
    setDebugView(view: MyriadDebugView, wireframe: boolean): void {
        this.debugView = debugViewIndex(view);
        this.edges = wireframe || view === 'triangles';
    }
    prepare(visible: VisibleSet, input: MeshPassInput, instances: InstanceBuffer, resolveMesh: MeshResolver): void {
        const { batcher } = this;
        batcher.build(visible, instances, input.selection, resolveMesh);
        this.stats.drawCalls = 0;
        this.stats.animatedShaders = 0;
        this.stats.triangles = batcher.stats.triangles;
        this.stats.instances = batcher.stats.instances;
        this.stats.batches = batcher.stats.batches;
        this.input = input;
        this.instances = instances;
    }
    renderDepth(surface = false): void {
        const { gl, batcher, input, instances } = this;
        if (!input || !instances)
            return;
        if (batcher.opaque.length === 0 && batcher.skinned.length === 0)
            return;
        if (!surface)
            gl.colorMask(false, false, false, false);
        const viewProjection = input.camera.viewProjectionMatrix;
        let program: ShaderProgram | null = null;
        let doubleSided = false;
        for (const batch of batcher.opaque) {
            const masked = batch.state.alphaMode === 'mask';
            const wanted = surface ? (masked ? this.surfaceMaskedProgram : this.surfaceProgram) : masked ? this.depthMaskedProgram : this.depthProgram;
            if (program !== wanted) {
                program = wanted;
                program.use();
                gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, viewProjection);
                if (masked)
                    gl.uniform1i(program.uniform('u_baseColorMap'), MATERIAL_TEXTURE_UNIT);
                if (surface)
                    gl.uniform1i(program.uniform('u_metallicRoughnessMap'), MATERIAL_TEXTURE_UNIT + 1);
            }
            if (batch.state.doubleSided !== doubleSided) {
                doubleSided = batch.state.doubleSided;
                if (doubleSided)
                    gl.disable(gl.CULL_FACE);
                else
                    gl.enable(gl.CULL_FACE);
            }
            if (masked || surface) {
                let mask = 0;
                if (masked && this.bindPrepassMap(batch.state, 0))
                    mask |= 1;
                if (surface && this.bindPrepassMap(batch.state, 1))
                    mask |= 2;
                gl.uniform1i(program.uniform('u_textureMask'), mask);
            }
            this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.count);
            this.stats.drawCalls++;
        }
        if (batcher.skinned.length > 0) {
            const skinned = surface ? this.surfaceSkinnedProgram : this.depthSkinnedProgram;
            skinned.use();
            gl.uniformMatrix4fv(skinned.uniform('u_viewProjection'), false, viewProjection);
            gl.uniform1i(skinned.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
            if (surface)
                gl.uniform1i(skinned.uniform('u_metallicRoughnessMap'), MATERIAL_TEXTURE_UNIT + 1);
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
                if (surface)
                    gl.uniform1i(skinned.uniform('u_textureMask'), this.bindPrepassMap(batch.state, 1) ? 2 : 0);
                gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, this.skins.resolve(skin));
                this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.count);
                this.stats.drawCalls++;
            }
        }
        if (!surface)
            gl.colorMask(true, true, true, true);
        gl.enable(gl.CULL_FACE);
    }
    private bindPrepassMap(state: MaterialState, slot: number): boolean {
        const { gl } = this;
        const texture = state.textures[slot];
        const handle = texture ? this.textures.resolve(texture) : null;
        gl.activeTexture(gl.TEXTURE0 + MATERIAL_TEXTURE_UNIT + slot);
        gl.bindTexture(gl.TEXTURE_2D, handle ?? this.textures.white);
        return handle !== null;
    }
    renderOpaque(): void {
        const { gl, batcher, input, instances } = this;
        if (!input || !instances)
            return;
        gl.depthMask(false);
        this.boundProgram = null;
        if (batcher.opaque.length > 0) {
            for (const batch of batcher.opaque)
                this.drawBatch(batch, instances, this.program, 'opaque', 'mask');
        }
        if (batcher.skinned.length > 0) {
            this.boundProgram = null;
            for (const batch of batcher.skinned) {
                const { skin } = batch.items[0].visible.entity;
                if (!skin)
                    continue;
                const texture = this.skins.resolve(skin);
                gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                this.drawBatch(batch, instances, this.skinnedProgram, 'skinned', 'mask');
            }
        }
        if (this.edges)
            this.renderEdges(instances);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
    }
    private renderEdges(instances: InstanceBuffer): void {
        const { gl, batcher, input } = this;
        if (!input)
            return;
        const viewProjection = input.camera.viewProjectionMatrix;
        if (batcher.opaque.length > 0) {
            const program = this.wireframeProgram;
            program.use();
            gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, viewProjection);
            for (const batch of batcher.opaque) {
                this.meshes.resolve(batch.mesh).drawEdgesInstanced(instances, batch.firstInstance, batch.count);
                this.stats.drawCalls++;
            }
        }
        if (batcher.skinned.length > 0) {
            const program = this.wireframeSkinnedProgram;
            program.use();
            gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, viewProjection);
            gl.uniform1i(program.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
            for (const batch of batcher.skinned) {
                const { skin } = batch.items[0].visible.entity;
                if (!skin)
                    continue;
                gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, this.skins.resolve(skin));
                this.meshes.resolve(batch.mesh).drawEdgesInstanced(instances, batch.firstInstance, batch.count);
                this.stats.drawCalls++;
            }
        }
        this.boundProgram = null;
    }
    renderTransparent(): void {
        const { gl, batcher, input, instances } = this;
        if (batcher.transparent.length === 0 || !input || !instances)
            return;
        this.boundProgram = null;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (const batch of batcher.transparent)
            this.drawBatch(batch, instances, this.transparentProgram, 'transparent', 'direct');
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
    private bindFrame(program: ShaderProgram, input: MeshPassInput, shadowSource: ShadowSource, variant: SurfaceVariant): void {
        const { gl } = this;
        program.use();
        bindSceneLightingUniforms(gl, program, input, shadowSource);
        for (let i = 0; i < TEXTURE_BINDINGS.length; i++) {
            gl.uniform1i(program.uniform(TEXTURE_BINDINGS[i].uniform), MATERIAL_TEXTURE_UNIT + i);
        }
        gl.uniform1i(program.uniform('u_debugView'), this.debugView);
        if (variant === 'skinned')
            gl.uniform1i(program.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
        this.boundProgram = program;
        this.boundState = null;
    }
    private drawBatch(batch: MeshBatch, instances: InstanceBuffer, fallback: ShaderProgram, variant: SurfaceVariant, shadowSource: ShadowSource): void {
        const { state } = batch;
        const custom = state.shader && this.surface ? this.surface.programFor(state.shader, variant) : null;
        const program = custom ? custom.program : fallback;
        if (program !== this.boundProgram)
            this.bindFrame(program, this.input as MeshPassInput, shadowSource, variant);
        if (state !== this.boundState || custom !== this.boundCustom) {
            this.boundCustom = custom;
            this.bindState(state);
        }
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
        const custom = this.boundCustom;
        if (custom && state.shader && this.surface) {
            this.surface.bind(custom, state.shader);
            if (this.surface.animated(state.shader))
                this.stats.animatedShaders++;
        }
    }
    dispose(): void {
        this.program.dispose();
        this.skinnedProgram.dispose();
        this.transparentProgram.dispose();
        this.depthProgram.dispose();
        this.depthMaskedProgram.dispose();
        this.depthSkinnedProgram.dispose();
        this.surfaceProgram.dispose();
        this.surfaceMaskedProgram.dispose();
        this.surfaceSkinnedProgram.dispose();
        this.wireframeProgram.dispose();
        this.wireframeSkinnedProgram.dispose();
    }
}
