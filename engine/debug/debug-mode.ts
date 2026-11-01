import { ingestScriptDocument } from '@/engine/assets/library/asset-ingest';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { attachScriptToEntity, compileProject, forgetScriptDocument } from '@/engine/editor/operations/script-operations';
import { getPrimitive } from '@/engine/editor/primitives/primitive-catalog';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { warmLanguageEngines } from '@/engine/scripting/languages/language-engine';
import { createScriptDocument } from '@/engine/scripting/script-document';
import { scriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { gameScripts, hasGame, otherShaderLanguage, shaderScripts, testableLanguages, type ShaderLanguageId } from './api-test-game/targets';
import { DEBUG_ACTOR_NAME, DEBUG_ASSET_PREFIX, DEBUG_GROUP_NAME, type DebugScriptSpec } from './api-test-game/types';
import { DebugBatchRunner } from './batch/batch-runner';
import type { BatchTarget, StepOutcome } from './batch/batch-types';
import { PlaytestBenchmark } from './bench/playtest-benchmark';
export type DebugPhase = 'idle' | 'clearing' | 'writing' | 'compiling' | 'ready' | 'failed';
const LOG_SOURCE = 'Debug';
const IDLE_MESSAGE = 'Escolha uma linguagem: o modo debug troca todos os scripts do projeto pelo jogo de teste nela.';
const RUNTIME_START_TIMEOUT_MS = 30000;
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class DebugModeController {
    phase: DebugPhase = 'idle';
    message = IDLE_MESSAGE;
    language: ScriptLanguageId | null = null;
    shaderLanguage: ShaderLanguageId = 'glsl';
    autoPlay = true;
    readonly batch: DebugBatchRunner;
    readonly benchmark: PlaytestBenchmark;
    private busy = false;
    constructor(private readonly session: EditorSession) {
        this.benchmark = new PlaytestBenchmark(session, () => session.notify());
        this.batch = new DebugBatchRunner(session, {
            install: (target) => this.install(target.language, target.shaders),
            compile: () => this.compile(),
            play: () => this.play(),
            stop: () => session.playtest.stop(),
            setBusy: (busy) => {
                this.busy = busy;
                session.notify();
            },
        });
    }
    get isBusy(): boolean {
        return this.busy;
    }
    setAutoPlay(value: boolean): void {
        this.autoPlay = value;
        this.session.notify();
    }
    async installGame(language: ScriptLanguageId): Promise<void> {
        if (this.busy || !hasGame(language)) {
            if (!hasGame(language))
                this.session.log.warn(LOG_SOURCE, `Ainda não há jogo de teste em ${scriptLanguage(language).label}.`);
            return;
        }
        this.busy = true;
        const label = scriptLanguage(language).label;
        try {
            await this.install(language, this.shaderLanguage);
            const compiled = await this.compile();
            if (!compiled.ok)
                return;
            if (this.autoPlay)
                await this.play();
            else
                this.setPhase('ready', `${compiled.message} Inicie o playtest e acompanhe o console (FALHOU/ERRO) e a HUD.`);
        }
        catch (cause) {
            this.setPhase('failed', `Não foi possível instalar o jogo em ${label}: ${describeError(cause)}`);
            this.session.log.error(LOG_SOURCE, this.message);
        }
        finally {
            this.busy = false;
            this.session.notify();
        }
    }
    async installShaders(language: ShaderLanguageId): Promise<void> {
        if (this.busy)
            return;
        this.busy = true;
        this.shaderLanguage = language;
        const label = scriptLanguage(language).label;
        const specs = shaderScripts(language);
        const names = new Set(specs.map((spec) => spec.name));
        try {
            this.session.playtest.stop();
            this.setPhase('clearing', `Removendo os shaders atuais…`);
            this.removeScripts((asset) => names.has(asset.name));
            this.setPhase('writing', `Escrevendo os shaders em ${label}…`);
            const written = await this.writeScripts(specs);
            this.session.log.info(LOG_SOURCE, `Shaders em ${label} instalados: ${written.map((item) => item.asset.name).join(', ')}.${this.language ? '' : ' Instale um jogo de teste para vê-los em uso.'}`);
            const compiled = await this.compile();
            if (!compiled.ok)
                return;
            if (this.autoPlay && this.language)
                await this.play();
            else
                this.setPhase('ready', `${compiled.message} Inicie o playtest e acompanhe o console (FALHOU/ERRO) e a HUD.`);
        }
        catch (cause) {
            this.setPhase('failed', `Não foi possível instalar os shaders em ${label}: ${describeError(cause)}`);
            this.session.log.error(LOG_SOURCE, this.message);
        }
        finally {
            this.busy = false;
            this.session.notify();
        }
    }
    async playInstalled(): Promise<void> {
        if (this.busy || !this.language || this.session.playtest.isRunning)
            return;
        this.busy = true;
        try {
            await this.play();
        }
        finally {
            this.busy = false;
            this.session.notify();
        }
    }
    async runBenchmark(seconds?: number): Promise<void> {
        if (this.busy || this.benchmark.isRunning)
            return;
        const { playtest } = this.session;
        if (!playtest.isRunning) {
            if (!this.language) {
                this.session.log.warn(LOG_SOURCE, 'Instale um jogo de teste ou inicie o playtest antes de medir.');
                return;
            }
            this.busy = true;
            try {
                const started = await this.play();
                if (!started.ok)
                    return;
            }
            finally {
                this.busy = false;
                this.session.notify();
            }
        }
        else if (playtest.state === 'paused') {
            playtest.play();
        }
        await this.benchmark.run(seconds);
    }
    runAll(): void {
        if (this.busy)
            return;
        const languages = testableLanguages();
        if (languages.length === 0)
            return;
        const targets: BatchTarget[] = [
            { language: languages[0].id, shaders: otherShaderLanguage(this.shaderLanguage), note: `shaders em ${scriptLanguage(otherShaderLanguage(this.shaderLanguage)).label}` },
            ...languages.map((language): BatchTarget => ({ language: language.id, shaders: this.shaderLanguage })),
        ];
        void this.batch.run(targets);
    }
    clear(): void {
        if (this.busy)
            return;
        this.session.playtest.stop();
        const removed = this.removeAssets((asset) => asset.name.startsWith(DEBUG_ASSET_PREFIX));
        this.removeDebugEntities();
        this.language = null;
        this.setPhase('idle', IDLE_MESSAGE);
        this.session.log.info(LOG_SOURCE, removed === 0 ? 'Nada do modo debug para remover.' : `${removed} ${removed === 1 ? 'ativo removido' : 'ativos removidos'} e a hierarquia do debug apagada.`);
    }
    private async install(language: ScriptLanguageId, shaders: ShaderLanguageId): Promise<void> {
        const specs = gameScripts(language, shaders);
        if (!specs)
            throw new Error(`Ainda não há jogo de teste em ${scriptLanguage(language).label}.`);
        const label = scriptLanguage(language).label;
        this.language = language;
        warmLanguageEngines([language, shaders]);
        this.session.playtest.stop();
        this.setPhase('clearing', `Removendo os scripts atuais para instalar o jogo em ${label}…`);
        this.removeScripts(() => true);
        this.removeDebugEntities();
        this.session.history.clear();
        this.session.scene.scripting.baseLanguage = language;
        this.setPhase('writing', `Escrevendo ${specs.length} arquivos em ${label}…`);
        const written = await this.writeScripts(specs);
        const entry = written.find((item) => item.spec.role === 'entry');
        const actor = written.find((item) => item.spec.role === 'actor');
        this.session.scene.scripting.entryScriptId = entry?.asset.id ?? null;
        if (actor)
            this.createHierarchyActor(actor.asset.id);
        this.session.log.info(LOG_SOURCE, `Jogo de teste em ${label} instalado: ${written.map((item) => item.asset.name).join(', ')}.`);
    }
    private async compile(): Promise<StepOutcome> {
        const label = this.language ? scriptLanguage(this.language).label : 'shaders';
        this.setPhase('compiling', `Compilando o projeto em ${label}…`);
        await compileProject(this.session);
        const { compileState, compileMessage } = this.session.code;
        if (compileState !== 'ok') {
            this.setPhase('failed', `Compilação em ${label}: ${compileMessage}`);
            return { ok: false, message: compileMessage };
        }
        return { ok: true, message: compileMessage };
    }
    private async play(): Promise<StepOutcome> {
        const label = this.language ? scriptLanguage(this.language).label : '?';
        this.setPhase('compiling', 'Iniciando o playtest…');
        this.session.playtest.play();
        const { scripts, playtest } = this.session;
        const deadline = performance.now() + RUNTIME_START_TIMEOUT_MS;
        while (scripts.starting && playtest.isRunning && performance.now() < deadline)
            await new Promise((resolve) => setTimeout(resolve, 50));
        if (!playtest.isRunning)
            return this.fail(`O playtest parou antes de o jogo em ${label} carregar; veja o console.`);
        if (scripts.starting)
            return this.fail(`O runtime de scripts não terminou de carregar o jogo em ${label} em ${RUNTIME_START_TIMEOUT_MS / 1000} s; veja o console.`, { log: true });
        if (!scripts.running)
            return this.fail(`O runtime de scripts não iniciou o jogo em ${label}; o erro está no console.`);
        const instances = scripts.instanceCount;
        if (instances === 0) {
            return this.fail(`O playtest está rodando, mas nenhum script foi instanciado em ${label}: o jogo de teste não entrou. Veja o console.`, {
                log: true,
                details: `Script de entrada: ${this.session.scene.scripting.entryScriptId ?? 'nenhum'}.`,
            });
        }
        this.setPhase('ready', `Jogo em ${label} rodando com ${instances} ${instances === 1 ? 'instância de script' : 'instâncias de script'}: acompanhe o console (FALHOU/ERRO) e a HUD.`);
        this.session.log.info(LOG_SOURCE, this.message);
        return { ok: true, message: this.message };
    }
    private fail(message: string, options: {
        log?: boolean;
        details?: string;
    } = {}): StepOutcome {
        this.setPhase('failed', message);
        if (options.log)
            this.session.log.error(LOG_SOURCE, options.details ? `${message} ${options.details}` : message);
        return { ok: false, message };
    }
    private removeScripts(predicate: (asset: LibraryAsset) => boolean): number {
        return this.removeAssets((asset) => asset.kind === 'script' && predicate(asset));
    }
    private removeAssets(predicate: (asset: LibraryAsset) => boolean): number {
        const { library, code, scene } = this.session;
        const doomed = library.all.filter(predicate);
        for (const asset of doomed) {
            code.close(asset.id);
            forgetScriptDocument(asset.id);
            if (scene.scripting.entryScriptId === asset.id)
                scene.scripting.entryScriptId = null;
            library.remove(asset.id);
        }
        this.detachOrphanScriptActors();
        return doomed.length;
    }
    private detachOrphanScriptActors(): void {
        const { scene, library } = this.session;
        const orphans: Entity[] = [];
        scene.traverse((entity) => {
            if (entity.script?.assetId && !library.get(entity.script.assetId))
                orphans.push(entity);
        });
        for (const entity of orphans)
            entity.parent?.remove(entity);
        if (orphans.length > 0)
            this.session.select(null);
    }
    private removeDebugEntities(): void {
        const { scene } = this.session;
        const group = scene.root.children.find((entity) => entity.name === DEBUG_GROUP_NAME && entity.kind === 'group');
        if (!group)
            return;
        scene.root.remove(group);
        this.session.select(null);
    }
    private async writeScripts(specs: readonly DebugScriptSpec[]): Promise<Array<{
        spec: DebugScriptSpec;
        asset: LibraryAsset;
    }>> {
        const { library } = this.session;
        const written: Array<{
            spec: DebugScriptSpec;
            asset: LibraryAsset;
        }> = [];
        for (const spec of specs) {
            const document = createScriptDocument({ name: spec.name, language: spec.language, source: spec.source, entry: spec.role === 'entry' });
            const result = await ingestScriptDocument(library, document, { forceNew: true });
            if (!result.added)
                throw new Error(`${spec.name} não entrou na biblioteca.`);
            library.add(result.added.snapshot);
            written.push({ spec, asset: result.added.snapshot.asset });
            this.setPhase('writing', `Escrito ${spec.name} (${scriptLanguage(spec.language).label}) · ${written.length}/${specs.length}`);
        }
        return written;
    }
    private createHierarchyActor(actorAssetId: string): void {
        const { scene } = this.session;
        const group = scene.createEntity({ name: DEBUG_GROUP_NAME, kind: 'group' }, scene.root);
        const box = scene.createEntity({
            name: DEBUG_ACTOR_NAME,
            kind: 'mesh',
            mesh: getPrimitive('box').create(),
            material: createMaterial({ baseColor: vec3.create(1, 0.53, 0), roughness: 0.5 }),
            rigidBody: createRigidBodySettings({ type: 'kinematic', collider: 'box' }),
        }, group);
        vec3.set(box.transform.position, 2, 0.5, 5);
        attachScriptToEntity(this.session, box, actorAssetId, { silent: true });
    }
    private setPhase(phase: DebugPhase, message: string): void {
        this.phase = phase;
        this.message = message;
        this.session.notify();
    }
}
const controllers = new WeakMap<EditorSession, DebugModeController>();
export function debugModeOf(session: EditorSession): DebugModeController {
    let controller = controllers.get(session);
    if (!controller) {
        controller = new DebugModeController(session);
        controllers.set(session, controller);
    }
    return controller;
}
