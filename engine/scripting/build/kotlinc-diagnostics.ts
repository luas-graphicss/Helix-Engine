import type { CompileDiagnostic } from '../compiler/compile-types';
const HEADER = /^(.+?\.kt):(\d+):(\d+): (error|warning|info): (.*)$/;
const BARE = /^(error|warning|exception): (.*)$/;
const CARET = /^\s*\^+\s*$/;
export interface KotlincDiagnostic extends CompileDiagnostic {
    readonly file: string;
}
export function parseKotlincOutput(output: string, file: string): KotlincDiagnostic[] {
    const diagnostics: KotlincDiagnostic[] = [];
    const lines = output.split('\n').map((line) => line.replace(/\r$/, ''));
    const unparsed: string[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        const header = HEADER.exec(line);
        if (!header) {
            const bare = BARE.exec(line.trim());
            if (bare) {
                diagnostics.push({ severity: bare[1] === 'warning' ? 'warning' : 'error', message: bare[2].trim(), line: 1, column: 1, code: 'toolchain', source: 'Kotlin', file: '' });
            }
            else if (line.trim()) {
                unparsed.push(line);
            }
            index++;
            continue;
        }
        const reportedFile = header[1].split(/[\\/]/).pop() ?? header[1];
        const inFile = reportedFile === file;
        index++;
        if (index < lines.length && !HEADER.test(lines[index]) && !BARE.test(lines[index].trim())) {
            index++;
            if (index < lines.length && CARET.test(lines[index]))
                index++;
        }
        if (header[4] === 'info')
            continue;
        diagnostics.push({
            severity: header[4] === 'error' ? 'error' : 'warning',
            message: header[5].trim() + (inFile ? '' : ` (em ${reportedFile})`),
            line: inFile ? Number(header[2]) : 1,
            column: inFile ? Number(header[3]) : 1,
            source: 'Kotlin',
            file: reportedFile,
        });
    }
    if (unparsed.length > 0 && diagnostics.length === 0) {
        diagnostics.push({ severity: 'error', message: `O kotlinc respondeu:\n${unparsed.join('\n')}`, line: 1, column: 1, code: 'toolchain', source: 'Kotlin', file: '' });
    }
    return diagnostics;
}
