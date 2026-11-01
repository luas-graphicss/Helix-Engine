import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import type { LogEntry } from '@/engine/editor/session/editor-log';
import type { BatchStep, BatchTarget, LanguageTestResult, SettleProfileId } from './batch-types';
const CHECKPOINT_KEY = 'debug.batch.checkpoint';
const CHECKPOINT_VERSION = 1;
export interface PassInProgress {
    readonly index: number;
    readonly attempt: number;
    readonly step: BatchStep;
    readonly compileMessage: string;
    readonly runtimeMessage: string;
    readonly entries: readonly LogEntry[];
    readonly elapsedMs: number;
}
export interface BatchCheckpoint {
    readonly targets: readonly BatchTarget[];
    readonly settle: SettleProfileId;
    readonly startedAt: number;
    readonly elapsedMs: number;
    readonly reloads: number;
    readonly results: readonly LanguageTestResult[];
    readonly current: PassInProgress | null;
}
interface StoredCheckpoint extends BatchCheckpoint {
    readonly version: number;
    readonly projectId: string;
    readonly savedAt: number;
}
export async function readBatchCheckpoint(projectId: string): Promise<BatchCheckpoint | null> {
    const stored = await readPreference<StoredCheckpoint>(CHECKPOINT_KEY);
    if (!stored || stored.version !== CHECKPOINT_VERSION || stored.projectId !== projectId)
        return null;
    return stored;
}
export function writeBatchCheckpoint(projectId: string, checkpoint: BatchCheckpoint): Promise<void> {
    return writePreference(CHECKPOINT_KEY, { ...checkpoint, version: CHECKPOINT_VERSION, projectId, savedAt: Date.now() } satisfies StoredCheckpoint);
}
export function clearBatchCheckpoint(): Promise<void> {
    return writePreference(CHECKPOINT_KEY, null);
}
