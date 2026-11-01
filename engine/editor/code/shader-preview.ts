import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Material } from '@/engine/core/scene/material';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { CustomPostEffect } from '@/engine/renderer/post/custom-post-pass';
import type { ScriptDebugLine, ScriptFrameTarget, ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import { SHADER_MODEL_LABEL } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { materialShader, setMaterialShader } from '@/engine/renderer/shaders/custom/material-shader-registry';
import { decodeShaderBundle, type CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { createShaderBinding, type ShaderBinding } from '@/engine/renderer/shaders/custom/shader-values';
import { collectScriptSources, publishCompileResult } from '@/engine/scripting/compiler/project-sources';
import { isShaderLanguage } from '@/engine/scripting/script-languages';
const LOG_SOURCE = 'Shaders';
const NO_WARMUP: readonly CompiledShaderBundle[] = [];
export type ShaderPreviewStatus = 'off' | 'compiling' | 'on' | 'error';
export interface ShaderPreviewTarget {
    readonly assetId: string;
    readonly bundle: CompiledShaderBundle;
    readonly entity: Entity | null;
}
function createFrameTarget(): ScriptFrameTarget {
    return {
        gl: null,
        width: 0,
        height: 0,
        pixelRatio: 1,
        elapsed: 0,
        delta: 0,
        view: mat4.create(),
        projection: mat4.create(),
        viewProjection: mat4.create(),
        cameraPosition: vec3.create(),
        sceneColor: null,
        sceneDepth: null,
        hdr: true,
    };
}
export class ShaderPreview implements ScriptRenderRequest {
    status: ShaderPreviewStatus = 'off';
    message: string | null = null;
    target: ShaderPreviewTarget | null = null;
    readonly enabled = true;
    readonly frame = createFrameTarget();
    readonly debugLines: readonly ScriptDebugLine[] = [];
    private assetId: string | null = null;
    private binding: ShaderBinding | null = null;
    private effects: CustomPostEffect[] = [];
    private surface: {
        entity: Entity;
        material: Material;
        previous: ShaderBinding | null;
    } | null = null;
    private compiledHash: string | null = null;
    private compiling = false;
    private token = 0;
    constructor(private readonly session: EditorSession) { }
    get active(): boolean {
        return this.assetId !== null;
    }
    get hasHooks(): boolean {
        return this.effects.length > 0;
    }
    get customPost(): readonly CustomPostEffect[] {
        return this.effects;
    }
    get renderRequest(): ScriptRenderRequest | null {
        return this.effects.length > 0 ? this : null;
    }
    isPreviewing(assetId: string): boolean {
        return this.assetId === assetId;
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
    async toggle(assetId: string): Promise<void> {
        if (this.assetId === assetId)
            this.stop();
        else
            await this.start(assetId);
    }
    async start(assetId: string): Promise<void> {
        const asset = this.shaderAsset(assetId);
        if (!asset) {
            this.session.log.warn(LOG_SOURCE, 'Só ativos GLSL ou WGSL podem ser pré-visualizados.');
            return;
        }
        if (this.session.playtest.isRunning) {
            this.session.log.warn(LOG_SOURCE, 'Pare o jogo para pré-visualizar um shader no editor; durante o jogo, quem liga shaders são os scripts.');
            return;
        }
        this.release();
        this.assetId = assetId;
        await this.compile(asset);
    }
    stop(): void {
        if (!this.active)
            return;
        this.release();
        this.assetId = null;
        this.status = 'off';
        this.message = null;
        this.target = null;
        this.compiledHash = null;
        this.session.notify();
    }
    sync(): void {
        if (!this.assetId || this.compiling)
            return;
        const { session } = this;
        if (session.playtest.isRunning) {
            this.stop();
            return;
        }
        const asset = this.shaderAsset(this.assetId);
        if (!asset) {
            this.stop();
            return;
        }
        if (this.surface && !session.scene.root.contains(this.surface.entity)) {
            this.stop();
            return;
        }
        if (this.compiledHash !== null && asset.contentHash !== this.compiledHash)
            void this.compile(asset);
    }
    private shaderAsset(assetId: string): LibraryAsset | null {
        const asset = this.session.library.get(assetId);
        if (!asset || asset.kind !== 'script' || asset.details.kind !== 'script' || !isShaderLanguage(asset.details.language))
            return null;
        return asset;
    }
    private async compile(asset: LibraryAsset): Promise<void> {
        const { session } = this;
        const token = ++this.token;
        this.compiling = true;
        this.status = 'compiling';
        this.message = `Compilando ${asset.name}…`;
        session.notify();
        try {
            const { inputs } = await collectScriptSources(session);
            const result = await session.scripts.compiler.compile(inputs, { roots: new Set([asset.id]) });
            if (token !== this.token)
                return;
            publishCompileResult(session, result, { source: LOG_SOURCE, silent: true });
            const compiled = result.compiled.find((script) => script.assetId === asset.id) ?? null;
            const current = session.library.get(asset.id);
            this.compiledHash = current?.contentHash ?? asset.contentHash;
            if (!compiled || compiled.errorCount > 0) {
                const first = compiled?.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
                this.fail(first ? `Linha ${first.line}: ${first.message}` : `${asset.name} não compilou.`);
                return;
            }
            const bundle = decodeShaderBundle(compiled.code);
            if (!bundle) {
                this.fail(`${asset.name} não produziu um shader utilizável.`);
                return;
            }
            this.apply(asset, bundle);
        }
        catch (cause) {
            if (token === this.token)
                this.fail(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            if (token === this.token) {
                this.compiling = false;
                session.notify();
            }
        }
    }
    private apply(asset: LibraryAsset, bundle: CompiledShaderBundle): void {
        const { session } = this;
        if (this.binding && this.binding.bundle.model === bundle.model) {
            this.binding.bundle = bundle;
            this.binding.values.retainDeclared(bundle);
            this.target = { assetId: asset.id, bundle, entity: this.surface?.entity ?? null };
            this.status = 'on';
            this.message = this.describe(asset, bundle);
            return;
        }
        this.release();
        const binding = createShaderBinding(bundle);
        if (bundle.model === 'post') {
            this.effects = [{ name: asset.name, binding, enabled: true }];
            this.target = { assetId: asset.id, bundle, entity: null };
        }
        else {
            const entity = session.selectedEntity;
            if (!entity || !entity.material) {
                this.fail('Selecione um ator com material para pré-visualizar um shader de superfície nele.');
                return;
            }
            const { material } = entity;
            this.surface = { entity, material, previous: materialShader(material) };
            setMaterialShader(material, binding);
            this.target = { assetId: asset.id, bundle, entity };
        }
        this.binding = binding;
        this.status = 'on';
        this.message = this.describe(asset, bundle);
        session.log.info(LOG_SOURCE, `${asset.name} em pré-visualização${this.surface ? ` em ${this.surface.entity.name}` : ' no viewport'}; salve o shader para atualizar, ou desligue a pré-visualização na barra de código.`);
    }
    private describe(asset: LibraryAsset, bundle: CompiledShaderBundle): string {
        const where = this.surface ? `no material de ${this.surface.entity.name}` : 'na cadeia de pós-processamento do viewport';
        return `${asset.name} (${SHADER_MODEL_LABEL[bundle.model]}) ${where}.`;
    }
    private fail(message: string): void {
        this.release();
        this.target = null;
        this.status = 'error';
        this.message = message;
        this.session.log.error(LOG_SOURCE, `Pré-visualização: ${message}`);
    }
    private release(): void {
        if (this.surface) {
            if (materialShader(this.surface.material) === this.binding)
                setMaterialShader(this.surface.material, this.surface.previous);
            this.surface = null;
        }
        this.effects = [];
        this.binding = null;
    }
}
