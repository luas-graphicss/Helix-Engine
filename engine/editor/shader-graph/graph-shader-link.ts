import type { Material } from '@/engine/core/scene/material';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { CustomPostEffect } from '@/engine/renderer/post/custom-post-pass';
import { createScriptFrameTarget, type ScriptDebugLine, type ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import { materialShader, setMaterialShader } from '@/engine/renderer/shaders/custom/material-shader-registry';
import { decodeShaderBundle, type CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { createShaderBinding, type ShaderBinding } from '@/engine/renderer/shaders/custom/shader-values';
import { compileGlslShader } from '@/engine/scripting/languages/shader/glsl-compiler';
import type { CompiledGraph } from '@/engine/shader-graph/compiler/graph-compiler';
import type { StoredShaderGraph } from '@/engine/shader-graph/storage/shader-graph-store';
import type { GraphTextureCache } from './graph-textures';
const LOG_SOURCE = 'Shader Graph';
const NO_WARMUP: readonly CompiledShaderBundle[] = [];
type BundleResult = {
    readonly ok: true;
    readonly bundle: CompiledShaderBundle;
} | {
    readonly ok: false;
    readonly message: string;
};
interface LiveLink {
    readonly graphId: string;
    readonly binding: ShaderBinding;
    source: string;
}
interface SurfaceLink extends LiveLink {
    readonly entityName: string;
    readonly material: Material;
    readonly previous: ShaderBinding | null;
}
function buildBundle(record: StoredShaderGraph, source: string): BundleResult {
    const output = compileGlslShader({ assetId: record.id, name: record.name, file: `${record.name}.glsl`, source });
    const failure = output.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
    if (failure)
        return { ok: false, message: failure.message };
    const bundle = decodeShaderBundle(output.code);
    return bundle ? { ok: true, bundle } : { ok: false, message: 'O grafo não produziu um shader utilizável.' };
}
export class GraphShaderLink implements ScriptRenderRequest {
    readonly enabled = true;
    readonly frame = createScriptFrameTarget();
    readonly debugLines: readonly ScriptDebugLine[] = [];
    private surface: SurfaceLink | null = null;
    private post: LiveLink | null = null;
    private effects: CustomPostEffect[] = [];
    constructor(private readonly session: EditorSession, private readonly textures: GraphTextureCache, private readonly onChange: () => void) { }
    get hasHooks(): boolean {
        return this.effects.length > 0;
    }
    get customPost(): readonly CustomPostEffect[] {
        return this.effects;
    }
    get renderRequest(): ScriptRenderRequest | null {
        return this.effects.length > 0 ? this : null;
    }
    isPassEnabled(): boolean {
        return true;
    }
    takeShaderWarmup(): readonly CompiledShaderBundle[] {
        return NO_WARMUP;
    }
    warn(message: string): void {
        this.session.log.warn(LOG_SOURCE, message);
    }
    before(): void { }
    beforePass(): void { }
    afterPass(): void { }
    after(): void { }
    linkedTarget(graphId: string): string | null {
        if (this.surface?.graphId === graphId)
            return this.surface.entityName;
        return this.post?.graphId === graphId ? 'viewport' : null;
    }
    attach(record: StoredShaderGraph, compiled: CompiledGraph): string | null {
        if (compiled.source === '')
            return 'Corrija os erros do grafo antes de aplicar.';
        const entity = compiled.model === 'surface' ? this.session.selectedEntity : null;
        const material = entity?.material ?? null;
        if (compiled.model === 'surface' && (!entity || !material))
            return 'Selecione na cena um ator com material para receber o shader.';
        const built = buildBundle(record, compiled.source);
        if (!built.ok)
            return built.message;
        const binding = createShaderBinding(built.bundle);
        this.fill(binding, compiled);
        if (entity && material) {
            this.releaseSurface();
            this.surface = { graphId: record.id, binding, source: compiled.source, entityName: entity.name, material, previous: materialShader(material) };
            setMaterialShader(material, binding);
            this.session.notify('scene');
        }
        else {
            this.post = { graphId: record.id, binding, source: compiled.source };
            this.effects = [{ name: record.name, binding, enabled: true }];
            this.session.notify('view');
        }
        this.onChange();
        return null;
    }
    detach(graphId: string): void {
        if (this.surface?.graphId === graphId) {
            this.releaseSurface();
            this.session.notify('scene');
        }
        if (this.post?.graphId === graphId) {
            this.post = null;
            this.effects = [];
            this.session.notify('view');
        }
        this.onChange();
    }
    refresh(record: StoredShaderGraph, compiled: CompiledGraph): void {
        const link = this.surface?.graphId === record.id ? this.surface : this.post?.graphId === record.id ? this.post : null;
        if (!link || compiled.source === '')
            return;
        if (compiled.source !== link.source) {
            const built = buildBundle(record, compiled.source);
            if (!built.ok) {
                this.session.log.warn(LOG_SOURCE, `${record.name}: ${built.message}`);
                return;
            }
            link.binding.bundle = built.bundle;
            link.binding.values.retainDeclared(built.bundle);
            link.source = compiled.source;
        }
        this.fill(link.binding, compiled);
        this.session.notify(link === this.post ? 'view' : 'scene');
    }
    private fill(binding: ShaderBinding, compiled: CompiledGraph): void {
        for (const uniform of compiled.uniforms) {
            if (uniform.kind === 'numeric') {
                binding.values.set(uniform.name, uniform.value.length === 1 ? uniform.value[0] : uniform.value);
                continue;
            }
            const texture = uniform.assetId ? this.textures.resolve(uniform.assetId, uniform.colorSpace) : null;
            if (texture)
                binding.values.set(uniform.name, texture);
            else
                binding.values.delete(uniform.name);
        }
    }
    private releaseSurface(): void {
        const link = this.surface;
        if (!link)
            return;
        if (materialShader(link.material) === link.binding)
            setMaterialShader(link.material, link.previous);
        this.surface = null;
    }
}
