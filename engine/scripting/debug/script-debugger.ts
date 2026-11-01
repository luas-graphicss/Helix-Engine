import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { CompiledScript } from '../compiler/compile-types';
import type { ForeignLocation } from '../languages/language-engine';
import type { LoadedModule } from '../runtime/module-loader';
import type { RuntimeMode, TimeState } from '../runtime/runtime-host';
import type { ModuleDebugHook } from '../runtime/sandbox';
import type { HookName, ScriptInstance } from '../runtime/script-instance';
import type { MappedFrame, StackMapper } from '../runtime/stack-mapper';
import { scriptFileName } from '../script-document';
import type { ScriptLanguageId } from '../script-languages';
import { formatValue, type FormattedValue } from './format-value';
import { hookContainingLine, scanHookDefinitions, type HookDefinition } from './hook-scan';
export interface Breakpoint {
    readonly id: number;
    readonly assetId: string;
    readonly line: number;
    readonly enabled: boolean;
    readonly condition: string | null;
    readonly logMessage: string | null;
}
export type BreakpointBinding = 'line' | 'hook' | 'unknown';
export interface BreakpointStatus {
    readonly breakpoint: Breakpoint;
    readonly binding: BreakpointBinding;
    readonly verified: boolean;
    readonly hook: HookName | null;
    readonly hits: number;
}
export interface DebugFrame {
    readonly kind: 'hook' | 'callback';
    readonly label: string;
    readonly script: string | null;
    readonly file: string | null;
    readonly assetId: string | null;
    readonly actor: string | null;
    readonly language: ScriptLanguageId | null;
    readonly startedAt: number;
}
export interface Variable {
    readonly name: string;
    readonly value: FormattedValue;
}
export interface PausedState {
    readonly reason: 'breakpoint' | 'error';
    readonly breakpointId: number | null;
    readonly assetId: string | null;
    readonly file: string;
    readonly line: number;
    readonly column: number | null;
    readonly script: string;
    readonly actor: string | null;
    readonly language: ScriptLanguageId | null;
    readonly phase: string | null;
    readonly frames: readonly MappedFrame[];
    readonly engineFrames: readonly DebugFrame[];
    readonly locals: readonly Variable[];
    readonly message: string | null;
    readonly gameFrame: number;
    readonly gameTime: number;
    readonly at: number;
}
export interface Watch {
    readonly id: number;
    readonly expression: string;
}
export interface WatchValue {
    readonly id: number;
    readonly expression: string;
    readonly value: FormattedValue | null;
    readonly error: string | null;
}
export interface PhaseActivity {
    calls: number;
    totalMs: number;
    lastMs: number;
    maxMs: number;
    errors: number;
}
export type ActivityState = 'active' | 'inactive' | 'faulted' | 'destroyed';
export interface ScriptActivity {
    readonly key: number;
    readonly assetId: string;
    readonly name: string;
    readonly file: string;
    readonly language: ScriptLanguageId;
    readonly actor: string | null;
    readonly role: 'entry' | 'actor';
    state: ActivityState;
    readonly phases: Map<string, PhaseActivity>;
    frameMs: number;
    smoothedMs: number;
    errors: number;
    lastError: string | null;
    lastActiveAt: number;
}
export interface DebuggerHost {
    readonly session: EditorSession;
    readonly stacks: StackMapper;
    readonly mode: RuntimeMode;
    readonly running: boolean;
    readonly current: ScriptInstance | null;
    readonly time: TimeState;
    compiledOf(assetId: string): CompiledScript | null;
    foreignLocation(): ForeignLocation | null;
    helixOf(instance: ScriptInstance | null): object;
    log(level: 'info' | 'warn' | 'error', message: string, extras?: {
        source?: string;
        location?: {
            assetId: string;
            file: string;
            line: number;
            column?: number;
        };
    }): void;
}
type Listener = () => void;
const MAX_FRAMES = 24;
const ACTIVITY_NOTIFY_MS = 150;
const SMOOTHING = 0.1;
const MIN_TABLE_SIZE = 4096;
interface ModuleScope {
    readonly module: LoadedModule;
    readonly scope: () => Record<string, unknown>;
}
type Evaluator = (...values: unknown[]) => unknown;
let nextBreakpointId = 1;
let nextWatchId = 1;
export class ScriptDebugger {
    breakpoints: readonly Breakpoint[] = [];
    breakpointsEnabled = true;
    pauseOnError = false;
    watches: readonly Watch[] = [];
    paused: PausedState | null = null;
    lastHit: PausedState | null = null;
    private readonly listeners = new Set<Listener>();
    private version = 0;
    private readonly hits = new Map<number, number>();
    private readonly tables = new Map<string, Uint8Array>();
    private readonly hooks = new Map<string, Set<{
        l: Uint8Array;
    }>>();
    private readonly moduleScopes = new Map<string, ModuleScope>();
    private readonly hookDefinitions = new Map<string, {
        source: string;
        definitions: HookDefinition[];
    }>();
    private readonly evaluators = new Map<string, Evaluator>();
    private readonly frames: DebugFrame[] = [];
    private readonly activities = new Map<number, ScriptActivity>();
    private watchValues: readonly WatchValue[] = [];
    private pausedScope: Record<string, unknown> | null = null;
    private pausedInstance: ScriptInstance | null = null;
    private lastActivityNotify = 0;
    private activityDirty = false;
    constructor(private readonly host: DebuggerHost) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    breakpointsOf(assetId: string): readonly Breakpoint[] {
        return this.breakpoints.filter((breakpoint) => breakpoint.assetId === assetId);
    }
    breakpointAt(assetId: string, line: number): Breakpoint | null {
        return this.breakpoints.find((breakpoint) => breakpoint.assetId === assetId && breakpoint.line === line) ?? null;
    }
    toggle(assetId: string, line: number): Breakpoint | null {
        const existing = this.breakpointAt(assetId, line);
        if (existing) {
            this.remove(existing.id);
            return null;
        }
        return this.add(assetId, line);
    }
    add(assetId: string, line: number, options: {
        condition?: string | null;
        logMessage?: string | null;
    } = {}): Breakpoint {
        const target = this.snapLine(assetId, line);
        const existing = this.breakpointAt(assetId, target);
        if (existing)
            return existing;
        const breakpoint: Breakpoint = { id: nextBreakpointId++, assetId, line: target, enabled: true, condition: options.condition ?? null, logMessage: options.logMessage ?? null };
        this.breakpoints = [...this.breakpoints, breakpoint].sort((a, b) => a.assetId.localeCompare(b.assetId) || a.line - b.line);
        this.syncTable(assetId);
        this.notify();
        return breakpoint;
    }
    update(id: number, patch: Partial<Pick<Breakpoint, 'enabled' | 'condition' | 'logMessage' | 'line'>>): void {
        const index = this.breakpoints.findIndex((breakpoint) => breakpoint.id === id);
        if (index === -1)
            return;
        const current = this.breakpoints[index];
        const next: Breakpoint = {
            ...current,
            enabled: patch.enabled ?? current.enabled,
            line: patch.line ?? current.line,
            condition: 'condition' in patch ? normalizeText(patch.condition) : current.condition,
            logMessage: 'logMessage' in patch ? normalizeText(patch.logMessage) : current.logMessage,
        };
        const breakpoints = [...this.breakpoints];
        breakpoints[index] = next;
        this.breakpoints = breakpoints;
        this.syncTable(current.assetId);
        this.notify();
    }
    remove(id: number): void {
        const target = this.breakpoints.find((breakpoint) => breakpoint.id === id);
        if (!target)
            return;
        this.breakpoints = this.breakpoints.filter((breakpoint) => breakpoint.id !== id);
        this.hits.delete(id);
        this.syncTable(target.assetId);
        this.notify();
    }
    removeAll(assetId?: string): void {
        const removed = assetId ? this.breakpoints.filter((breakpoint) => breakpoint.assetId === assetId) : this.breakpoints;
        if (removed.length === 0)
            return;
        const ids = new Set(removed.map((breakpoint) => breakpoint.id));
        this.breakpoints = this.breakpoints.filter((breakpoint) => !ids.has(breakpoint.id));
        for (const id of ids)
            this.hits.delete(id);
        for (const target of new Set(removed.map((breakpoint) => breakpoint.assetId)))
            this.syncTable(target);
        this.notify();
    }
    setAllEnabled(enabled: boolean): void {
        if (this.breakpoints.every((breakpoint) => breakpoint.enabled === enabled))
            return;
        this.breakpoints = this.breakpoints.map((breakpoint) => ({ ...breakpoint, enabled }));
        for (const assetId of new Set(this.breakpoints.map((breakpoint) => breakpoint.assetId)))
            this.syncTable(assetId);
        this.notify();
    }
    setBreakpointsEnabled(enabled: boolean): void {
        if (this.breakpointsEnabled === enabled)
            return;
        this.breakpointsEnabled = enabled;
        for (const assetId of new Set(this.breakpoints.map((breakpoint) => breakpoint.assetId)))
            this.syncTable(assetId);
        this.notify();
    }
    setPauseOnError(enabled: boolean): void {
        if (this.pauseOnError === enabled)
            return;
        this.pauseOnError = enabled;
        this.notify();
    }
    shiftLines(assetId: string, fromLine: number, delta: number): void {
        if (delta === 0)
            return;
        let changed = false;
        const breakpoints = this.breakpoints.map((breakpoint) => {
            if (breakpoint.assetId !== assetId || breakpoint.line < fromLine)
                return breakpoint;
            changed = true;
            return { ...breakpoint, line: Math.max(1, breakpoint.line + delta) };
        });
        if (!changed)
            return;
        const seen = new Set<string>();
        this.breakpoints = breakpoints.filter((breakpoint) => {
            const key = `${breakpoint.assetId}:${breakpoint.line}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        this.syncTable(assetId);
        this.notify();
    }
    statusOf(breakpoint: Breakpoint): BreakpointStatus {
        const binding = this.bindingOf(breakpoint.assetId);
        const hits = this.hits.get(breakpoint.id) ?? 0;
        if (binding === 'line') {
            const lines = this.host.compiledOf(breakpoint.assetId)?.debugLines ?? null;
            return { breakpoint, binding, verified: lines ? lines.includes(breakpoint.line) : true, hook: null, hits };
        }
        if (binding === 'hook') {
            const definition = hookContainingLine(this.definitionsOf(breakpoint.assetId), breakpoint.line);
            return { breakpoint, binding, verified: definition !== null, hook: definition?.hook ?? null, hits };
        }
        return { breakpoint, binding, verified: false, hook: null, hits };
    }
    statuses(): BreakpointStatus[] {
        return this.breakpoints.map((breakpoint) => this.statusOf(breakpoint));
    }
    bindingOf(assetId: string): BreakpointBinding {
        const compiled = this.host.compiledOf(assetId);
        const language = compiled?.language ?? this.languageOf(assetId);
        if (compiled?.kind === 'module')
            return compiled.debugCode ? 'line' : 'hook';
        if (compiled?.kind === 'foreign')
            return 'hook';
        if (!language)
            return 'unknown';
        return isJavaScriptTarget(language) ? 'unknown' : 'hook';
    }
    private languageOf(assetId: string): ScriptLanguageId | null {
        const asset = this.host.session.library.get(assetId);
        if (asset?.kind === 'script' && asset.details.kind === 'script')
            return asset.details.language;
        return null;
    }
    private sourceOf(assetId: string): string | null {
        return this.host.session.code.tab(assetId)?.document.source ?? this.host.compiledOf(assetId)?.source ?? null;
    }
    private definitionsOf(assetId: string): readonly HookDefinition[] {
        const source = this.sourceOf(assetId);
        if (source === null)
            return [];
        const cached = this.hookDefinitions.get(assetId);
        if (cached && cached.source === source)
            return cached.definitions;
        const definitions = scanHookDefinitions(source);
        this.hookDefinitions.set(assetId, { source, definitions });
        return definitions;
    }
    private snapLine(assetId: string, line: number): number {
        const compiled = this.host.compiledOf(assetId);
        const lines = compiled?.debugLines;
        if (!lines || lines.length === 0 || lines.includes(line))
            return line;
        for (const candidate of lines)
            if (candidate > line && candidate - line <= 8)
                return candidate;
        return line;
    }
    private tableOf(assetId: string): Uint8Array {
        let table = this.tables.get(assetId);
        if (!table) {
            const source = this.sourceOf(assetId);
            const lines = source ? source.split('\n').length : 0;
            table = new Uint8Array(Math.max(MIN_TABLE_SIZE, lines + 256));
            this.tables.set(assetId, table);
            this.syncTable(assetId);
        }
        return table;
    }
    private syncTable(assetId: string): void {
        let table = this.tables.get(assetId);
        if (!table)
            return;
        const active = this.breakpointsEnabled ? this.breakpoints.filter((breakpoint) => breakpoint.assetId === assetId && breakpoint.enabled) : [];
        const needed = active.reduce((max, breakpoint) => Math.max(max, breakpoint.line + 1), 0);
        if (needed > table.length) {
            const grown = new Uint8Array(Math.max(needed + 256, table.length * 2));
            this.tables.set(assetId, grown);
            for (const hook of this.hooks.get(assetId) ?? [])
                hook.l = grown;
            table = grown;
        }
        table.fill(0);
        for (const breakpoint of active)
            table[breakpoint.line] = 1;
    }
    hookFor(module: LoadedModule): ModuleDebugHook {
        const { assetId } = module.compiled;
        const hook = {
            l: this.tableOf(assetId),
            h: (line: number, scope: () => Record<string, unknown>) => this.hitLine(module, line, scope),
            s: (scope: () => Record<string, unknown>) => {
                this.moduleScopes.set(assetId, { module, scope });
            },
        };
        let set = this.hooks.get(assetId);
        if (!set) {
            set = new Set();
            this.hooks.set(assetId, set);
        }
        set.add(hook);
        return hook;
    }
    forgetModule(assetId: string): void {
        this.hooks.delete(assetId);
        this.moduleScopes.delete(assetId);
    }
    private hitLine(module: LoadedModule, line: number, scopeFn: () => Record<string, unknown>): void {
        const breakpoint = this.breakpointAt(module.compiled.assetId, line);
        if (!breakpoint || !breakpoint.enabled || !this.breakpointsEnabled)
            return;
        let scope: Record<string, unknown> | null = null;
        const getScope = (): Record<string, unknown> => {
            if (!scope) {
                try {
                    scope = scopeFn();
                }
                catch {
                    scope = {};
                }
            }
            return scope;
        };
        this.fire(breakpoint, { file: module.file, line, column: null, language: module.compiled.language, scope: getScope, frames: () => this.scriptFrames(new Error().stack) });
    }
    beforeHook(instance: ScriptInstance, name: HookName): void {
        if (!this.breakpointsEnabled || this.breakpoints.length === 0)
            return;
        const { assetId } = instance;
        if (this.bindingOf(assetId) !== 'hook')
            return;
        const definitions = this.definitionsOf(assetId);
        if (definitions.length === 0)
            return;
        for (const breakpoint of this.breakpoints) {
            if (breakpoint.assetId !== assetId || !breakpoint.enabled)
                continue;
            const definition = hookContainingLine(definitions, breakpoint.line);
            if (!definition || definition.hook !== name)
                continue;
            this.enter(instance, instance, name);
            try {
                this.fire(breakpoint, { file: instance.file, line: breakpoint.line, column: null, language: instance.language, scope: () => ({}), frames: () => [], instance });
            }
            finally {
                this.exit();
            }
            return;
        }
    }
    private fire(breakpoint: Breakpoint, at: {
        file: string;
        line: number;
        column: number | null;
        language: ScriptLanguageId;
        scope: () => Record<string, unknown>;
        frames: () => MappedFrame[];
        instance?: ScriptInstance;
    }): void {
        const instance = at.instance ?? this.host.current;
        if (breakpoint.condition) {
            const outcome = this.evaluate(breakpoint.condition, at.scope(), instance);
            if (outcome.error) {
                this.host.log('warn', `Condição do ponto em ${at.file}:${at.line} falhou: ${outcome.error}`, { location: { assetId: breakpoint.assetId, file: at.file, line: at.line } });
                return;
            }
            if (!outcome.value)
                return;
        }
        this.hits.set(breakpoint.id, (this.hits.get(breakpoint.id) ?? 0) + 1);
        if (breakpoint.logMessage) {
            const text = this.interpolate(breakpoint.logMessage, at.scope(), instance);
            this.host.log('info', text, { source: instance?.name ?? this.host.session.library.get(breakpoint.assetId)?.name, location: { assetId: breakpoint.assetId, file: at.file, line: at.line } });
            this.notify();
            return;
        }
        if (this.paused)
            return;
        const scope = at.scope();
        const state = this.capture({
            reason: 'breakpoint',
            breakpointId: breakpoint.id,
            assetId: breakpoint.assetId,
            file: at.file,
            line: at.line,
            column: at.column,
            language: at.language,
            instance,
            frames: at.frames(),
            scope,
            message: null,
        });
        this.pause(state, scope, instance);
    }
    errorReported(instance: ScriptInstance | null, phase: string, cause: unknown, location: {
        assetId: string;
        file: string;
        line: number;
        column?: number;
    } | null): void {
        if (!this.pauseOnError || this.paused || this.host.mode !== 'play')
            return;
        const frames = cause instanceof Error ? this.scriptFrames(cause.stack) : [];
        const origin = location ?? (frames[0] && frames[0].assetId ? { assetId: frames[0].assetId, file: frames[0].file, line: frames[0].line, column: frames[0].column ?? undefined } : null);
        const state = this.capture({
            reason: 'error',
            breakpointId: null,
            assetId: origin?.assetId ?? instance?.assetId ?? null,
            file: origin?.file ?? instance?.file ?? 'Scripts',
            line: origin?.line ?? 0,
            column: origin?.column ?? null,
            language: instance?.language ?? null,
            instance,
            frames,
            scope: {},
            message: `${phase}: ${cause instanceof Error ? cause.message : String(cause)}`,
        });
        this.pause(state, null, instance);
    }
    private capture(input: {
        reason: 'breakpoint' | 'error';
        breakpointId: number | null;
        assetId: string | null;
        file: string;
        line: number;
        column: number | null;
        language: ScriptLanguageId | null;
        instance: ScriptInstance | null;
        frames: MappedFrame[];
        scope: Record<string, unknown>;
        message: string | null;
    }): PausedState {
        const locals: Variable[] = [];
        for (const [name, value] of Object.entries(input.scope))
            locals.push({ name, value: formatValue(value) });
        const { instance } = input;
        return {
            reason: input.reason,
            breakpointId: input.breakpointId,
            assetId: input.assetId,
            file: input.file,
            line: input.line,
            column: input.column,
            script: instance?.name ?? this.host.session.library.get(input.assetId ?? '')?.name ?? input.file.replace(/\.[^.]+$/, ''),
            actor: instance?.self?.name ?? null,
            language: input.language,
            phase: this.frames.at(-1)?.label ?? null,
            frames: input.frames.slice(0, MAX_FRAMES),
            engineFrames: this.frames.slice().reverse(),
            locals,
            message: input.message,
            gameFrame: this.host.time.frame,
            gameTime: this.host.time.now,
            at: Date.now(),
        };
    }
    private pause(state: PausedState, scope: Record<string, unknown> | null, instance: ScriptInstance | null): void {
        this.lastHit = state;
        this.pausedScope = scope;
        this.pausedInstance = instance;
        if (this.host.mode === 'play') {
            this.paused = state;
            this.host.session.playtest.pause();
            const where = state.line > 0 ? `${state.file}:${state.line}` : state.file;
            this.host.log('info', state.reason === 'error' ? `Pausado por erro em ${where}.` : `Pausado em ${where}${state.actor ? ` (${state.actor})` : ''}.`, { source: 'Depurador', location: state.assetId && state.line > 0 ? { assetId: state.assetId, file: state.file, line: state.line } : undefined });
        }
        this.refreshWatches();
        this.notify();
    }
    private scriptFrames(stack: string | undefined): MappedFrame[] {
        if (!stack)
            return [];
        return this.host.stacks.map(stack).frames.filter((frame) => frame.script);
    }
}
