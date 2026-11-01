export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogLocation {
    readonly assetId: string;
    readonly file: string;
    readonly line: number;
    readonly column?: number;
}
export interface LogEntryExtras {
    readonly location?: LogLocation;
    readonly details?: string;
}
export interface LogEntry extends LogEntryExtras {
    readonly id: number;
    readonly elapsedMs: number;
    readonly level: LogLevel;
    readonly source: string;
    readonly message: string;
    readonly repeat: number;
}
const DEFAULT_LIMIT = 500;
export type LogObserver = (entry: LogEntry) => void;
export class EditorLog {
    private ring: (LogEntry | undefined)[];
    private head = 0;
    private size = 0;
    private nextId = 1;
    private readonly startedAt = performance.now();
    private limit = DEFAULT_LIMIT;
    private readonly observers = new Set<LogObserver>();
    private readonly counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    private snapshot: readonly LogEntry[] | null = null;
    constructor(private readonly onChange: () => void) {
        this.ring = new Array<LogEntry | undefined>(DEFAULT_LIMIT);
    }
    get entries(): readonly LogEntry[] {
        if (this.snapshot)
            return this.snapshot;
        const entries = new Array<LogEntry>(this.size);
        const capacity = this.ring.length;
        for (let i = 0; i < this.size; i++)
            entries[i] = this.ring[(this.head + i) % capacity] as LogEntry;
        this.snapshot = entries;
        return entries;
    }
    observe(observer: LogObserver): () => void {
        this.observers.add(observer);
        return () => this.observers.delete(observer);
    }
    setLimit(limit: number): void {
        const next = Math.max(1, Math.floor(limit));
        if (next === this.limit)
            return;
        this.limit = next;
        const kept = this.entries.slice(Math.max(0, this.size - next));
        this.ring = new Array<LogEntry | undefined>(next);
        for (let i = 0; i < kept.length; i++)
            this.ring[i] = kept[i];
        this.head = 0;
        const dropped = this.size - kept.length;
        this.size = kept.length;
        if (dropped > 0) {
            this.recount();
            this.changed();
        }
    }
    debug(source: string, message: string, extras?: LogEntryExtras): void {
        this.push('debug', source, message, extras);
    }
    info(source: string, message: string, extras?: LogEntryExtras): void {
        this.push('info', source, message, extras);
    }
    warn(source: string, message: string, extras?: LogEntryExtras): void {
        this.push('warn', source, message, extras);
    }
    error(source: string, message: string, extras?: LogEntryExtras): void {
        this.push('error', source, message, extras);
    }
    count(level: LogLevel): number {
        return this.counts[level];
    }
    clear(): void {
        if (this.size === 0)
            return;
        this.ring.fill(undefined);
        this.head = 0;
        this.size = 0;
        this.counts.debug = this.counts.info = this.counts.warn = this.counts.error = 0;
        this.changed();
    }
    private push(level: LogLevel, source: string, message: string, extras?: LogEntryExtras): void {
        const capacity = this.ring.length;
        const lastIndex = (this.head + this.size - 1) % capacity;
        const last = this.size > 0 ? this.ring[lastIndex] : undefined;
        if (last && last.level === level && last.source === source && last.message === message && last.details === extras?.details && sameLocation(last.location, extras?.location)) {
            const repeated = { ...last, repeat: last.repeat + 1, elapsedMs: performance.now() - this.startedAt };
            this.ring[lastIndex] = repeated;
            this.counts[level]++;
            this.changed();
            this.emit(repeated);
            return;
        }
        const entry: LogEntry = { id: this.nextId++, elapsedMs: performance.now() - this.startedAt, level, source, message, repeat: 1, location: extras?.location, details: extras?.details };
        if (this.size === capacity) {
            const evicted = this.ring[this.head] as LogEntry;
            this.counts[evicted.level] -= evicted.repeat;
            this.ring[this.head] = entry;
            this.head = (this.head + 1) % capacity;
        }
        else {
            this.ring[(this.head + this.size) % capacity] = entry;
            this.size++;
        }
        this.counts[level]++;
        this.changed();
        this.emit(entry);
    }
    private recount(): void {
        this.counts.debug = this.counts.info = this.counts.warn = this.counts.error = 0;
        const capacity = this.ring.length;
        for (let i = 0; i < this.size; i++) {
            const entry = this.ring[(this.head + i) % capacity] as LogEntry;
            this.counts[entry.level] += entry.repeat;
        }
    }
    private changed(): void {
        this.snapshot = null;
        this.onChange();
    }
    private emit(entry: LogEntry): void {
        for (const observer of this.observers)
            observer(entry);
    }
}
function sameLocation(a: LogLocation | undefined, b: LogLocation | undefined): boolean {
    if (!a || !b)
        return a === b;
    return a.assetId === b.assetId && a.line === b.line && a.column === b.column;
}
export function formatElapsed(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor(elapsedMs % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
