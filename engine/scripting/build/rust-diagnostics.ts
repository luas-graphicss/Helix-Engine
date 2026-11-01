import 'server-only';
import type { CompileDiagnostic, CompileSeverity } from '../compiler/compile-types';
interface RustSpan {
    readonly file_name: string;
    readonly line_start: number;
    readonly line_end: number;
    readonly column_start: number;
    readonly column_end: number;
    readonly is_primary: boolean;
    readonly label: string | null;
    readonly suggested_replacement: string | null;
    readonly expansion: {
        readonly span: RustSpan;
    } | null;
}
interface RustMessage {
    readonly message: string;
    readonly level: string;
    readonly code: {
        readonly code: string;
    } | null;
    readonly spans: readonly RustSpan[];
    readonly children: readonly RustMessage[];
}
interface RustJsonLine {
    readonly $message_type?: string;
}
const IGNORED = [/^aborting due to/, /^For more information about this error/, /^Some errors have detailed explanations/, /^\d+ warnings? emitted$/, /^warning: \d+ warnings? emitted/];
export function parseRustcJson(stderr: string, file: string): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const unparsed: string[] = [];
    for (const raw of stderr.split('\n')) {
        const line = raw.trim();
        if (!line)
            continue;
        if (!line.startsWith('{')) {
            unparsed.push(line);
            continue;
        }
        let parsed: (RustJsonLine & Partial<RustMessage>) | null;
        try {
            parsed = JSON.parse(line) as RustJsonLine & Partial<RustMessage>;
        }
        catch {
            unparsed.push(line);
            continue;
        }
        if (parsed.$message_type !== 'diagnostic' || !parsed.message)
            continue;
        const message = parsed as RustMessage;
        if (IGNORED.some((pattern) => pattern.test(message.message)))
            continue;
        const diagnostic = toDiagnostic(message, file);
        if (diagnostic)
            diagnostics.push(diagnostic);
    }
    if (unparsed.length > 0) {
        diagnostics.push({ severity: 'error', message: `O rustc terminou com uma saída inesperada:\n${unparsed.join('\n')}`, line: 1, column: 1, code: 'toolchain', source: 'Rust' });
    }
    return diagnostics;
}
function toDiagnostic(message: RustMessage, file: string): CompileDiagnostic | null {
    const severity = severityOf(message.level);
    if (!severity)
        return null;
    const primary = message.spans.find((span) => span.is_primary) ?? message.spans[0] ?? null;
    const located = primary ? locateInFile(primary, file) : null;
    const parts = [message.message];
    if (primary?.label && !message.message.includes(primary.label))
        parts[0] += ` (${primary.label})`;
    if (primary && !located)
        parts.push(`em ${primary.file_name}:${primary.line_start}:${primary.column_start}`);
    for (const child of message.children) {
        const text = describeChild(child, file);
        if (text)
            parts.push(text);
    }
    return {
        severity,
        message: parts.join('\n'),
        line: located?.line_start ?? 1,
        column: located?.column_start ?? 1,
        ...(located && located.line_end === located.line_start ? { endLine: located.line_end, endColumn: Math.max(located.column_end, located.column_start + 1) } : {}),
        ...(message.code ? { code: message.code.code } : {}),
        source: 'Rust',
    };
}
function locateInFile(span: RustSpan, file: string): RustSpan | null {
    let current: RustSpan | null = span;
    while (current) {
        if (current.file_name === file)
            return current;
        current = current.expansion?.span ?? null;
    }
    return null;
}
function describeChild(child: RustMessage, file: string): string | null {
    const text = child.message.trim();
    if (!text)
        return null;
    const span = child.spans.find((entry) => entry.is_primary) ?? child.spans[0];
    const where = span ? locateInFile(span, file) : null;
    const suffix = span?.suggested_replacement != null ? `: \`${span.suggested_replacement.trim()}\`` : '';
    const position = where && where.line_start > 0 ? ` (linha ${where.line_start})` : '';
    return `${child.level}: ${text}${suffix}${position}`;
}
function severityOf(level: string): CompileSeverity | null {
    if (level === 'error' || level.startsWith('error'))
        return 'error';
    if (level === 'warning')
        return 'warning';
    if (level === 'note' || level === 'help')
        return 'info';
    return null;
}
