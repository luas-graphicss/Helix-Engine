import { formatElapsed, type LogEntry, type LogLevel } from './editor-log';
export const LOG_LEVEL_TAG: Record<LogLevel, string> = {
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'AVISO',
    error: 'ERRO',
};
export interface FormatLogOptions {
    details?: boolean;
    elapsed?: boolean;
}
export function formatLogEntry(entry: LogEntry, options: FormatLogOptions = {}): string {
    const { details = true, elapsed = true } = options;
    const parts: string[] = [];
    if (elapsed)
        parts.push(formatElapsed(entry.elapsedMs));
    parts.push(`[${LOG_LEVEL_TAG[entry.level]}]`, `${entry.source}:`, entry.message);
    if (entry.location)
        parts.push(`(${entry.location.file}:${entry.location.line}${entry.location.column !== undefined ? `:${entry.location.column}` : ''})`);
    if (entry.repeat > 1)
        parts.push(`×${entry.repeat}`);
    const line = parts.join(' ');
    if (!details || !entry.details)
        return line;
    const indented = entry.details
        .split('\n')
        .map((item) => `    ${item}`)
        .join('\n');
    return `${line}\n${indented}`;
}
export function formatLogEntries(entries: readonly LogEntry[], options: FormatLogOptions = {}): string {
    return entries.map((entry) => formatLogEntry(entry, options)).join('\n');
}
export function isNoteworthy(entry: LogEntry): boolean {
    return entry.level === 'warn' || entry.level === 'error';
}
