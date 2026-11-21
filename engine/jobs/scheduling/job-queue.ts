export const JOB_PRIORITIES = ['high', 'normal', 'low'] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];
interface Prioritized {
    readonly priority: JobPriority;
}
export class JobQueue<TEntry extends Prioritized> {
    private readonly lanes: Record<JobPriority, TEntry[]> = { high: [], normal: [], low: [] };
    get size(): number {
        return this.lanes.high.length + this.lanes.normal.length + this.lanes.low.length;
    }
    push(entry: TEntry): void {
        this.lanes[entry.priority].push(entry);
    }
    shift(): TEntry | undefined {
        for (const priority of JOB_PRIORITIES) {
            const entry = this.lanes[priority].shift();
            if (entry)
                return entry;
        }
        return undefined;
    }
    remove(entry: TEntry): void {
        const lane = this.lanes[entry.priority];
        const index = lane.indexOf(entry);
        if (index >= 0)
            lane.splice(index, 1);
    }
}
