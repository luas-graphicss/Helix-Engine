export type JobOutcomeStatus = 'completed' | 'failed' | 'cancelled' | 'timeout';
export interface JobBatchInfo {
    readonly index: number;
    readonly count: number;
}
export interface JobRecord {
    readonly id: number;
    readonly name: string;
    readonly label: string;
    readonly batch: JobBatchInfo | null;
    readonly thread: number | null;
    readonly status: JobOutcomeStatus;
    readonly queuedAt: number;
    readonly startedAt: number | null;
    readonly finishedAt: number;
    readonly error: string | null;
}
export interface JobTotals {
    readonly scheduled: number;
    readonly completed: number;
    readonly failed: number;
    readonly cancelled: number;
    readonly timedOut: number;
}
export const JOB_HISTORY_LIMIT = 240;
const TOTAL_OF_STATUS: Record<JobOutcomeStatus, Exclude<keyof JobTotals, 'scheduled'>> = {
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
    timeout: 'timedOut',
};
function emptyTotals(): Record<keyof JobTotals, number> {
    return { scheduled: 0, completed: 0, failed: 0, cancelled: 0, timedOut: 0 };
}
export class JobHistory {
    private records: JobRecord[] = [];
    private counters = emptyTotals();
    get totals(): JobTotals {
        return { ...this.counters };
    }
    get list(): readonly JobRecord[] {
        return this.records;
    }
    scheduled(): void {
        this.counters.scheduled += 1;
    }
    record(entry: JobRecord): void {
        this.counters[TOTAL_OF_STATUS[entry.status]] += 1;
        this.records = [...this.records.slice(-(JOB_HISTORY_LIMIT - 1)), entry];
    }
    clear(): void {
        this.records = [];
        this.counters = emptyTotals();
    }
}
