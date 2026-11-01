import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { saveMeshToLibrary } from '@/engine/editor/operations/mesh-library-operations';
import { buildPrefabInstance, savePrefabToLibrary } from '@/engine/editor/operations/prefab-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { LogEntryExtras, LogLevel, LogLocation } from '@/engine/editor/session/editor-log';
import type { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { Joint } from '@/engine/physics/joints/joint';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { entityLodOverride, isEntityMyriadEnabled, setEntityLodOverride, setEntityMyriadEnabled, type EntityLodOverride } from '@/engine/renderer/render-overrides';
import type { ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import { decodeShaderBundle, type CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { NO_LINK, serverRunsHere, type NetLink } from '@/engine/net/transport/net-link';
import type { JsonValue } from '@/engine/net/protocol';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { CameraEffects } from '../api/camera';
import { DebugDrawQueue } from '../api/core';
import { auditHelixRoot, createHelixFor, createHelixRoot, type HelixRoot } from '../api/helix';
import { AxisLocks, ContactTracker } from '../api/physics';
import { PropRegistry } from '../api/props';
import { RenderState } from '../api/render';
import { SkyWatcher } from '../api/sky';
import { isExecutableKind, isImportableKind, type CompiledScript } from '../compiler/compile-types';
import { collectScriptSources, publishCompileResult, toCodeDiagnostics } from '../compiler/project-sources';
import { EXECUTABLE_LANGUAGES, isCompilableLanguage, ScriptCompiler, type CompileBatchResult, type ScriptSourceInput } from '../compiler/script-compiler';
import { ScriptDebugger, type DebuggerHost } from '../debug/script-debugger';
import { ForeignScriptError } from '../languages/foreign-values';
import { scriptFileName } from '../script-document';
import { formatLanguageLabels, scriptLanguage, type ScriptLanguageId } from '../script-languages';
import { isAuthoritative } from '../scripting-settings';
import { WebUiHost } from '../web/web-ui-host';
import { EventBus } from './event-bus';
import { ForeignGames, toLogLocation, type ForeignGameServices } from './foreign-games';
import { InputState } from './input-state';
import { ModuleLoader, type LoadedModule } from './module-loader';
import { NetHub, type NetHubServices } from './net-hub';
import { ScriptRenderBridge } from './render-bridge';
import type { ScriptOwner } from './runtime-context';
import type { FrameHooks, RuntimeHost, RuntimeMode, ScriptContext, SystemSwitches, TimeState } from './runtime-host';
import { Scheduler } from './scheduler';
import { createScriptConsole } from './script-console';
import { describeThrown, HelixArgumentError, HelixError, HelixNotImplementedError, isTaskCancelled } from './script-errors';
import { hooksFromFunctions, ScriptInstance, type HookName, type HooksResolver } from './script-instance';
import { ShaderBindings, type ShaderMaterial } from './shader-bindings';
import { StackMapper } from './stack-mapper';
import { requireObject } from './values';
const LOG_SOURCE = 'Scripts';
function isGenericErrorName(name: string): boolean {
    return name === 'Error' || name.startsWith('Helix');
}
const FRAME_HOOKS: ReadonlySet<string> = new Set(['onUpdate', 'onFixedUpdate', 'onLateUpdate', 'onRender']);
const MAX_CONSECUTIVE_FAILURES = 3;
const SETUP_PHASES: ReadonlySet<string> = new Set(['onLoad', 'onStart', 'onHotReload', 'construtor']);
const PERSISTENT_HOOKS: readonly HookName[] = ['onUpdate', 'onFixedUpdate', 'onLateUpdate', 'onRender'];
const ACTOR_SYNC_INTERVAL = 30;
function createTimeState(): TimeState {
    return { now: 0, delta: 0, fixedDelta: 1 / 60, unscaledDelta: 0, frame: 0, startedAt: 0 };
}
function createSwitches(): SystemSwitches {
    return { render: true, post: true, sky: true, physics: true, gui: true, audio: true, locomotion: true };
}
function createFrameHooks(): FrameHooks {
    return { before: [], after: [], beforePass: new Map(), afterPass: new Map(), custom: [] };
}
function isLibraryAsset(value: unknown): value is LibraryAsset {
    return typeof value === 'object' && value !== null && typeof (value as LibraryAsset).id === 'string' && typeof (value as LibraryAsset).kind === 'string' && typeof (value as LibraryAsset).name === 'string';
}
function foreignLanguagesOf(compiled: readonly CompiledScript[]): Set<ScriptLanguageId> {
    const languages = new Set<ScriptLanguageId>();
    for (const script of compiled)
        if (script.kind === 'foreign' && script.errorCount === 0)
            languages.add(script.language);
    return languages;
}
function parseTicket(text: string): JsonValue | null {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    try {
        return JSON.parse(trimmed) as JsonValue;
    }
    catch {
        return trimmed;
    }
}
export interface RuntimeStartOptions {
    readonly entry?: LibraryAsset;
}
export class ScriptRuntime implements RuntimeHost {
    readonly compiler = new ScriptCompiler();
    readonly stacks = new StackMapper();
    readonly debug = new DebugDrawQueue();
    readonly renderState = new RenderState();
    readonly cameraEffects = new CameraEffects();
    readonly props = new PropRegistry();
    readonly time = createTimeState();
    readonly switches = createSwitches();
    readonly frameHooks = createFrameHooks();
    readonly updaters = new Set<(dt: number) => void>();
    readonly disposers = new Set<() => void>();
    bus: EventBus;
    scheduler: Scheduler;
    input: InputState;
    web: WebUiHost;
    mode: RuntimeMode = 'play';
    current: ScriptInstance | null = null;
    running = false;
    starting = false;
    private readonly locks = new AxisLocks();
    private readonly contacts = new ContactTracker(this);
    private readonly sky = new SkyWatcher(this);
    private readonly renderBridge = new ScriptRenderBridge(this, this.renderState, this.frameHooks);
    readonly shaders = new ShaderBindings({
        resolveAsset: (value, member) => this.resolveAsset(value, member, 'script'),
        compiledOf: (assetId) => this.compiled.get(assetId) ?? null,
        log: (level, message) => this.say(level, message),
    });
    private readonly foreign = new ForeignGames(this.foreignServices());
    readonly scriptDebugger = new ScriptDebugger(this.debuggerHost());
    private loader: ModuleLoader;
    private helixRoot: HelixRoot = {};
    private readonly compiled = new Map<string, CompiledScript>();
    private readonly instances: ScriptInstance[] = [];
    private readonly byActor = new Map<Entity, ScriptInstance>();
    private readonly pendingActors = new Set<Entity>();
    private readonly pendingCompiles = new Set<string>();
    private readonly warnedAssets = new Set<string>();
    private readonly spawned = new Set<Entity>();
    private readonly removed: Array<{
        entity: Entity;
        parent: Entity;
        index: number;
    }> = [];
    private readonly objectUrls = new Map<string, string>();
    private actorSyncRequested = false;
    private lastInvokeFailed = false;
    private runToken = 0;
    private entryName: string | null = null;
    readonly net: NetHub;
    constructor(readonly session: EditorSession) {
        this.bus = new EventBus(this);
        this.scheduler = new Scheduler(this);
        this.input = new InputState(this.bus);
        this.web = new WebUiHost(this.webAssets());
        this.loader = this.createLoader();
        this.net = new NetHub(this.netServices());
    }
    private netServices(): NetHubServices {
        return {
            run: (owner, fn) => {
                const instance = owner instanceof ScriptInstance ? owner : null;
                const previous = this.current;
                this.current = instance;
                try {
                    return this.scheduler.runInTask(owner, fn);
                }
                finally {
                    this.current = previous;
                }
            },
            currentOwner: () => this.current,
            currentContext: () => this.current?.runContext ?? null,
            log: (level, message) => this.say(level, message),
            report: (owner, phase, cause) => this.reportError(owner, phase, cause),
            emitBus: (name, payload) => void this.bus.emit(name, payload),
            onBus: (name, handler, owner) => this.bus.on(name, handler, owner),
            localPlayerName: () => 'Jogador',
            entityAlive: (entity) => entity === this.session.scene.root || this.session.scene.root.contains(entity),
        };
    }
    async start(mode: RuntimeMode, options: RuntimeStartOptions = {}): Promise<void> {
        if (this.running || this.starting)
            this.stop();
        const token = ++this.runToken;
        const startedAt = performance.now();
        this.mode = mode;
        this.starting = true;
        this.entryName = options.entry?.name ?? null;
        this.resetServices();
        this.session.notify();
        try {
            await this.boot(mode, options, token, startedAt);
        }
        catch (cause) {
            if (token !== this.runToken)
                return;
            this.abortStart(cause);
        }
    }
    private async boot(mode: RuntimeMode, options: RuntimeStartOptions, token: number, startedAt: number): Promise<void> {
        const link = this.planLink(mode);
        const { inputs, skipped } = await collectScriptSources(this.session);
        if (token !== this.runToken)
            return;
        const roots = mode === 'play' ? this.playRoots(link) : options.entry ? new Set([options.entry.id]) : undefined;
        if (roots)
            for (const assetId of this.namedAssetRoots(inputs))
                roots.add(assetId);
        let result: CompileBatchResult;
        try {
            result = await this.compiler.compile(inputs, { roots });
        }
        catch (cause) {
            if (token !== this.runToken)
                return;
            this.starting = false;
            this.say('error', `O compilador não pôde ser carregado: ${describeThrown(cause)}`);
            this.session.code.setCompileState('failed', 'Compilador indisponível nesta aba; veja o console.');
            this.session.notify();
            return;
        }
        if (token !== this.runToken)
            return;
        const summary = publishCompileResult(this.session, result, { source: LOG_SOURCE, skipped, silent: true });
        this.compiled.clear();
        for (const script of result.compiled)
            this.compiled.set(script.assetId, script);
        this.running = true;
        this.time.startedAt = performance.now();
        this.renderBridge.reset();
        this.renderState.shaderWarmup = result.compiled.filter((script) => script.kind === 'shader' && script.errorCount === 0).map((script) => decodeShaderBundle(script.code)).filter((bundle): bundle is CompiledShaderBundle => bundle !== null);
        this.input.attach(this.session.viewportCanvas);
        this.web.attach(this.session.viewportCanvas?.parentElement ?? null);
        this.startNet(link);
        this.helixRoot = createHelixRoot(this, { props: this.props, locks: this.locks });
        this.loader = this.createLoader();
        const audit = auditHelixRoot(this.helixRoot, mode);
        if (audit.missing.length > 0)
            this.say('warn', `API incompleta: ${audit.missing.length} de ${audit.total} membros do manifesto sem ponte (${audit.missing.slice(0, 8).join(', ')}${audit.missing.length > 8 ? '…' : ''}).`);
        await this.foreign.ensureAll(foreignLanguagesOf(result.compiled));
        if (token !== this.runToken)
            return;
        const physics = this.session.playtest.physics;
        if (mode === 'play' && physics) {
            const { frameProfile } = this.session;
            this.disposers.add(physics.world.addPreStepHook((h) => {
                frameProfile.begin('scripts');
                try {
                    this.fixedStep(h);
                }
                finally {
                    frameProfile.end('scripts');
                }
            }));
        }
        if (mode === 'editor') {
            const entry = options.entry;
            if (!entry)
                throw new Error('start("editor") precisa do script a executar.');
            this.startTool(entry, startedAt);
        }
        else {
            this.syncActors();
            this.createEntryInstance();
            this.sortInstances();
            for (const instance of this.instances.slice())
                this.load(instance);
            this.starting = false;
            this.updateActivation();
            const actors = this.instances.filter((instance) => instance.role === 'actor').length;
            const modules = this.loader.loaded.length;
            const duration = Math.max(1, Math.round(performance.now() - startedAt));
            if (modules === 0 && summary.errors === 0)
                this.say('info', `Jogo sem scripts: ${this.compiled.size === 0 ? 'nenhum script ligado para compilar' : 'nenhum ator de script ligado na cena aponta para um script de código'}.`);
            else
                this.say(summary.errors > 0 ? 'warn' : 'info', `${modules} ${modules === 1 ? 'módulo' : 'módulos'} em ${actors} ${actors === 1 ? 'ator' : 'atores'} (${result.reused} do cache)${summary.errors > 0 ? `; ${summary.failed.length} ${summary.failed.length === 1 ? 'script com erros ficou' : 'scripts com erros ficaram'} de fora` : ''} · ${duration} ms.`);
        }
        this.starting = false;
        this.session.notify();
    }
}
