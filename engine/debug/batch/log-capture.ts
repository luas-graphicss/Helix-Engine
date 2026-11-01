import type { EditorLog, LogEntry } from '@/engine/editor/session/editor-log';
export class LogCapture {
    private readonly entries = new Map<number, LogEntry>();
    private unsubscribe: (() => void) | null = null;
    private lastEntryAt = performance.now();
    constructor(private readonly log: EditorLog, private readonly onEntry?: () => void) { }
    start(): void {
        this.entries.clear();
        this.lastEntryAt = performance.now();
        this.unsubscribe?.();
        this.unsubscribe = this.log.observe((entry) => {
            this.entries.set(entry.id, entry);
            this.lastEntryAt = performance.now();
            this.onEntry?.();
        });
    }
    peek(): LogEntry[] {
        return Array.from(this.entries.values()).sort((a, b) => a.id - b.id);
    }
    stop(): LogEntry[] {
        this.unsubscribe?.();
        this.unsubscribe = null;
        return this.peek();
    }
    get quietForMs(): number {
        return performance.now() - this.lastEntryAt;
    }
}
