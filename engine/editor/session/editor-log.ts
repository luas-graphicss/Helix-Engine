export type LogLevel = 'info' | 'warn' | 'error';
export interface LogEntry {
    readonly id: number;
    readonly elapsedMs: number;
    readonly level: LogLevel;
    readonly source: string;
    readonly message: string;
}
export class EditorLog {
    readonly entries: LogEntry[] = [];
    private nextId = 1;
    private readonly startedAt = performance.now();
    constructor(private readonly onChange: () => void, private readonly limit = 500) { }
    info(source: string, message: string): void {
        this.push('info', source, message);
    }
    warn(source: string, message: string): void {
        this.push('warn', source, message);
    }
    error(source: string, message: string): void {
        this.push('error', source, message);
    }
    count(level: LogLevel): number {
        return this.entries.reduce((total, entry) => (entry.level === level ? total + 1 : total), 0);
    }
    clear(): void {
        this.entries.length = 0;
        this.onChange();
    }
    private push(level: LogLevel, source: string, message: string): void {
        this.entries.push({ id: this.nextId++, elapsedMs: performance.now() - this.startedAt, level, source, message });
        if (this.entries.length > this.limit)
            this.entries.shift();
        this.onChange();
    }
}
export function formatElapsed(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor(elapsedMs % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
