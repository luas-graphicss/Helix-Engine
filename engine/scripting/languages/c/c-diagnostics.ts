import type { CompileDiagnostic, CompileSeverity } from '../../compiler/compile-types';
const DIAGNOSTIC = /^(.+?):(\d+):(\d+):((?:\{\d+:\d+-\d+:\d+\})*):?\s+(fatal error|error|warning|note|remark):\s+(.*)$/;
const RANGE = /\{(\d+):(\d+)-(\d+):(\d+)\}/;
const INCLUDED_FROM = /^In file included from (.+?):(\d+)(?::\d+)?[:,]\s*$/;
const LINKER = /^wasm-ld:\s*(error|warning):\s*(.*)$/;
const UNDEFINED_SYMBOL = /undefined symbol:\s*(.+)$/;
const SUMMARY = /^\d+ (?:errors?|warnings?)(?: and \d+ (?:errors?|warnings?))? generated\.$/;
const SOURCE_PREFIX = '/src/';
export interface ClangOutputOptions {
    readonly file: string;
    readonly source: string;
    readonly exitCode: number;
}
export function parseClangOutput(output: string, options: ClangOutputOptions): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const unmatched: string[] = [];
    let includeLine: number | null = null;
    for (const raw of output.split('\n')) {
        const line = raw.trimEnd();
        if (line.length === 0 || SUMMARY.test(line))
            continue;
        const included = INCLUDED_FROM.exec(line);
        if (included) {
            if (stripSourcePrefix(included[1]) === options.file)
                includeLine = Number(included[2]);
            continue;
        }
        const linker = LINKER.exec(line);
        if (linker) {
            diagnostics.push({ severity: linker[1] === 'error' ? 'error' : 'warning', message: describeLinkerMessage(linker[2]), line: 1, column: 1, code: 'link', source: 'Linker' });
            continue;
        }
        const match = DIAGNOSTIC.exec(line);
        if (!match) {
            unmatched.push(line);
            continue;
        }
        const [, path, lineText, columnText, ranges, kind, message] = match;
        const file = stripSourcePrefix(path);
        const severity = severityOf(kind);
        if (file === options.file) {
            const range = RANGE.exec(ranges);
            const diagnosticLine = Number(lineText);
            const column = Number(columnText);
            const sameLine = range && Number(range[1]) === diagnosticLine && Number(range[3]) === diagnosticLine;
            diagnostics.push({
                severity,
                message,
                line: diagnosticLine,
                column,
                ...(sameLine ? { endLine: diagnosticLine, endColumn: Math.max(column + 1, Number(range[4])) } : {}),
                source: options.source,
            });
            includeLine = null;
            continue;
        }
        diagnostics.push({
            severity,
            message: `${file}:${lineText}:${columnText}: ${message}`,
            line: includeLine ?? 1,
            column: 1,
            source: options.source,
        });
    }
    const hasError = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
    if (options.exitCode !== 0 && !hasError) {
        const detail = unmatched.join('\n').trim();
        diagnostics.push({
            severity: 'error',
            message: detail ? `O compilador terminou com código ${options.exitCode}: ${detail}` : `O compilador terminou com código ${options.exitCode} sem explicar o motivo.`,
            line: 1,
            column: 1,
            code: 'toolchain',
            source: options.source,
        });
    }
    else if (unmatched.length > 0 && hasError) {
        diagnostics.push({ severity: 'info', message: unmatched.join('\n'), line: 1, column: 1, source: options.source });
    }
    return diagnostics;
}
function stripSourcePrefix(path: string): string {
    return path.startsWith(SOURCE_PREFIX) ? path.slice(SOURCE_PREFIX.length) : path;
}
function severityOf(kind: string): CompileSeverity {
    if (kind === 'error' || kind === 'fatal error')
        return 'error';
    if (kind === 'warning')
        return 'warning';
    return 'info';
}
function describeLinkerMessage(message: string): string {
    const undefinedSymbol = UNDEFINED_SYMBOL.exec(message);
    if (undefinedSymbol) {
        const symbol = undefinedSymbol[1].trim();
        return `Função ou variável não definida: ${symbol}. Defina-a neste arquivo ou inclua o script que a define.`;
    }
    return message.replace(/^\/out\/[^:]+:\s*/, '');
}
