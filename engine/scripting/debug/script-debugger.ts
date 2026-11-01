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
}
