import type { CompileDiagnostic } from '../compiler/compile-types';
const HEADER = /^(.+?):(\d+):(\d+): (error|warning|note): (.*)$/;
const REFERENCE = /^\s+\S.*?: (.+?):(\d+):(\d+)$/;
const BARE = /^(?:error|warning): (.*)$/;
const QUOTED_NAME = /'([A-Za-z_][\w]*)'/;
interface Pending {
    readonly diagnostic: {
        severity: 'error' | 'warning';
        message: string;
        line: number;
        column: number;
        source: string;
    };
    located: boolean;
}
export function parseZigOutput(stderr: string, options: {
    readonly file: string;
    readonly writtenAs: string;
    readonly source: string;
}): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const unparsed: string[] = [];
    let last: Pending | null = null;
    let inReferences = false;
    for (const raw of stderr.split('\n')) {
        const line = raw.replace(/\r$/, '');
        const header = HEADER.exec(line);
        if (header) {
            inReferences = false;
            const [, reported, lineText, columnText, kind, text] = header;
            const reportedFile = baseName(reported);
            const inFile = reportedFile === options.writtenAs;
            if (kind === 'note') {
                if (last)
                    last.diagnostic.message += `\nnota: ${text.trim()}${inFile ? ` (linha ${lineText})` : ''}`;
                continue;
            }
            const message = text.trim();
            const pending: Pending = {
                diagnostic: { severity: kind === 'error' ? 'error' : 'warning', message, line: inFile ? Number(lineText) : 1, column: inFile ? Number(columnText) : 1, source: 'Zig' },
                located: inFile,
            };
            if (!inFile) {
                const declared = declarationLine(options.source, message);
                if (declared) {
                    pending.diagnostic.line = declared.line;
                    pending.diagnostic.column = declared.column;
                    pending.located = true;
                }
                else if (!isSdkFile(reportedFile)) {
                    pending.diagnostic.message = `${message} (em ${reportedFile})`;
                }
            }
            diagnostics.push(pending.diagnostic);
            last = pending;
            continue;
        }
        if (/^referenced by:$/.test(line.trim())) {
            inReferences = true;
            continue;
        }
        if (inReferences) {
            const reference = REFERENCE.exec(line);
            if (reference && last && !last.located && baseName(reference[1]) === options.writtenAs) {
                last.diagnostic.line = Number(reference[2]);
                last.diagnostic.column = Number(reference[3]);
                last.located = true;
            }
            if (!reference && line.trim() !== '' && !/reference\(s\) hidden/.test(line))
                inReferences = false;
            continue;
        }
        const bare = BARE.exec(line);
        if (bare)
            unparsed.push(bare[1].trim());
    }
    if (unparsed.length > 0 && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        diagnostics.push({ severity: 'error', message: `O zig respondeu:\n${unparsed.join('\n')}`, line: 1, column: 1, code: 'toolchain', source: 'Zig' });
    }
    return diagnostics;
}
function baseName(reported: string): string {
    return reported.split(/[\\/]/).pop() ?? reported;
}
function isSdkFile(file: string): boolean {
    return file === 'helix.zig' || file === 'main.zig';
}
function declarationLine(source: string, message: string): {
    line: number;
    column: number;
} | null {
    const quoted = QUOTED_NAME.exec(message);
    if (!quoted)
        return null;
    const pattern = new RegExp(`\\bfn\\s+${quoted[1]}\\s*\\(`);
    const lines = source.split('\n');
    for (let index = 0; index < lines.length; index++) {
        const match = pattern.exec(lines[index]);
        if (match)
            return { line: index + 1, column: match.index + 1 };
    }
    return null;
}
