export interface JobSettings {
    enabled: boolean;
    threads: number;
    timeoutSeconds: number;
    maxQueued: number;
}
export const AUTOMATIC_THREADS = 0;
export const MAX_JOB_THREADS = 16;
export const MAX_JOB_TIMEOUT_SECONDS = 120;
export const QUEUE_LIMITS: readonly number[] = [256, 1024, 4096, 16384];
const RESERVED_CORES = 1;
const MILLISECONDS_PER_SECOND = 1000;
export function createJobSettings(): JobSettings {
    return { enabled: true, threads: AUTOMATIC_THREADS, timeoutSeconds: 10, maxQueued: 4096 };
}
function clamp(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}
function nearestQueueLimit(value: number, fallback: number): number {
    if (!Number.isFinite(value))
        return fallback;
    return QUEUE_LIMITS.reduce((best, limit) => (Math.abs(limit - value) < Math.abs(best - value) ? limit : best), QUEUE_LIMITS[0]);
}
export function normalizeJobSettings(settings: JobSettings): JobSettings {
    const defaults = createJobSettings();
    return {
        enabled: settings.enabled !== false,
        threads: clamp(Number(settings.threads), AUTOMATIC_THREADS, MAX_JOB_THREADS, defaults.threads),
        timeoutSeconds: clamp(Number(settings.timeoutSeconds), 0, MAX_JOB_TIMEOUT_SECONDS, defaults.timeoutSeconds),
        maxQueued: nearestQueueLimit(Number(settings.maxQueued), defaults.maxQueued),
    };
}
export function automaticThreadCount(logicalCores: number): number {
    const cores = Number.isFinite(logicalCores) ? Math.floor(logicalCores) : 1;
    return Math.min(MAX_JOB_THREADS, Math.max(1, cores - RESERVED_CORES));
}
export function resolveThreadCount(settings: JobSettings, logicalCores: number): number {
    return settings.threads === AUTOMATIC_THREADS ? automaticThreadCount(logicalCores) : settings.threads;
}
export function resolveTimeoutMs(settings: JobSettings): number {
    return settings.timeoutSeconds * MILLISECONDS_PER_SECOND;
}
