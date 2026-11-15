import type { WorkerEnv } from './durable-object-types';
const POLL_TO_WINDOW_MARGIN_MS = 10000;
const RANGES = {
    callTimeoutMs: { fallback: 45000, min: 5000, max: 55000 },
    pollWaitMs: { fallback: 25000, min: 1000, max: 30000 },
    queueLimit: { fallback: 64, min: 1, max: 500 },
    engineWindowMs: { fallback: 40000, min: 10000, max: 120000 },
    fileTtlMs: { fallback: 900000, min: 60000, max: 3600000 },
} as const;
interface IntegerRange {
    readonly fallback: number;
    readonly min: number;
    readonly max: number;
}
export interface WorkerSettings {
    readonly callTimeoutMs: number;
    readonly pollWaitMs: number;
    readonly queueLimit: number;
    readonly engineWindowMs: number;
    readonly fileTtlMs: number;
    readonly secret: string;
}
function boundedInteger(raw: string | undefined, range: IntegerRange): number {
    const parsed = Number(raw);
    if (raw === undefined || raw.trim() === '' || !Number.isFinite(parsed))
        return range.fallback;
    return Math.min(range.max, Math.max(range.min, Math.round(parsed)));
}
export function readWorkerSettings(env: WorkerEnv): WorkerSettings {
    const pollWaitMs = boundedInteger(env.POLL_WAIT_MS, RANGES.pollWaitMs);
    return {
        callTimeoutMs: boundedInteger(env.CALL_TIMEOUT_MS, RANGES.callTimeoutMs),
        pollWaitMs,
        queueLimit: boundedInteger(env.QUEUE_LIMIT, RANGES.queueLimit),
        engineWindowMs: Math.max(boundedInteger(env.ENGINE_WINDOW_MS, RANGES.engineWindowMs), pollWaitMs + POLL_TO_WINDOW_MARGIN_MS),
        fileTtlMs: boundedInteger(env.FILE_TTL_MS, RANGES.fileTtlMs),
        secret: (env.SECRET ?? '').trim(),
    };
}
