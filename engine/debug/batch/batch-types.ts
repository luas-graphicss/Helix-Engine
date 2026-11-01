import type { LogEntry } from '@/engine/editor/session/editor-log';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import type { ShaderLanguageId } from '../api-test-game/targets';
export interface BatchTarget {
    readonly language: ScriptLanguageId;
    readonly shaders: ShaderLanguageId;
    readonly note?: string;
}
export type BatchStep = 'install' | 'compile' | 'play' | 'settle';
export const BATCH_STEP_LABEL: Record<BatchStep, string> = {
    install: 'instalando o jogo',
    compile: 'compilando',
    play: 'iniciando o playtest',
    settle: 'jogando e observando o console',
};
export type BatchState = 'idle' | 'running' | 'done' | 'cancelled';
export type LanguageTestStatus = 'passed' | 'issues' | 'install-failed' | 'compile-failed' | 'runtime-failed' | 'interrupted' | 'cancelled';
export interface LanguageTestResult {
    readonly target: BatchTarget;
    readonly label: string;
    readonly status: LanguageTestStatus;
    readonly compileMessage: string;
    readonly runtimeMessage: string;
    readonly entries: readonly LogEntry[];
    readonly errors: number;
    readonly warnings: number;
    readonly durationMs: number;
    readonly reloads: number;
}
export interface BatchProgress {
    readonly target: BatchTarget;
    readonly label: string;
    readonly index: number;
    readonly total: number;
    readonly step: BatchStep;
}
export interface SettleProfile {
    readonly id: SettleProfileId;
    readonly label: string;
    readonly minMs: number;
    readonly quietMs: number;
    readonly maxMs: number;
}
export type SettleProfileId = 'quick' | 'normal' | 'long';
export const SETTLE_PROFILES: readonly SettleProfile[] = [
    { id: 'quick', label: '5 s', minMs: 5000, quietMs: 1500, maxMs: 10000 },
    { id: 'normal', label: '10 s', minMs: 10000, quietMs: 2000, maxMs: 20000 },
    { id: 'long', label: '20 s', minMs: 20000, quietMs: 3000, maxMs: 40000 },
];
export function settleProfile(id: SettleProfileId): SettleProfile {
    return SETTLE_PROFILES.find((profile) => profile.id === id) ?? SETTLE_PROFILES[1];
}
export interface StepOutcome {
    readonly ok: boolean;
    readonly message: string;
}
export interface DebugBatchSteps {
    install(target: BatchTarget): Promise<void>;
    compile(): Promise<StepOutcome>;
    play(): Promise<StepOutcome>;
    stop(): void;
    setBusy(busy: boolean): void;
}
