import type { CompileDiagnostic } from '../compiler/compile-types';
const HEADER = /^(.+?):(\d+):(\d+): (error|warning|note|remark): (.*)$/;
const BARE = /^(?:<unknown>:0: |wasm-ld: |swiftc: |error: |warning: )(.*)$/;
export function parseSwiftcOutput(stderr: string, file: string): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const unparsed: string[] = [];
    let last: {
        severity: 'error' | 'warning';
        message: string;
        line: number;
        column: number;
        source: string;
    } | null = null;
    for (const raw of stderr.split('\n')) {
        const line = raw.replace(/\r$/, '');
        const header = HEADER.exec(line);
        if (!header) {
            const bare = BARE.exec(line);
            if (bare && !/^\d+ (errors?|warnings?)/.test(line))
                unparsed.push(line.trim());
            continue;
        }
        const [, reported, lineText, columnText, kind, text] = header;
        const reportedFile = reported.split(/[\\/]/).pop() ?? reported;
        const inFile = reportedFile === file;
        if (kind === 'note' || kind === 'remark') {
            if (last)
                last.message += `\n${kind === 'note' ? 'nota' : 'observação'}: ${text.trim()}${inFile ? ` (linha ${lineText})` : ''}`;
            continue;
        }
        last = {
            severity: kind === 'error' ? 'error' : 'warning',
            message: text.trim() + (inFile ? '' : ` (em ${reportedFile})`),
            line: inFile ? Number(lineText) : 1,
            column: inFile ? Number(columnText) : 1,
            source: 'Swift',
        };
        diagnostics.push(last);
    }
    if (unparsed.length > 0 && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        const text = unparsed.filter((line) => !/^error: (link command failed|compile command failed|fatalError)/.test(line)).join('\n') || unparsed.join('\n');
        diagnostics.push({ severity: 'error', message: `O swiftc respondeu:\n${text}`, line: 1, column: 1, code: 'toolchain', source: 'Swift' });
    }
    return diagnostics;
}
