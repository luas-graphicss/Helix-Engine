import type { CompileDiagnostic } from '../compiler/compile-types';
const HEADER = /^(.+?\.java):(\d+): (error|warning): (.*)$/;
const SUMMARY = /^\d+ (errors?|warnings?)$/;
const NOTE = /^Note: /;
export function parseJavacOutput(stderr: string, file: string): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const lines = stderr.split('\n').map((line) => line.replace(/\r$/, ''));
    const unparsed: string[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        const header = HEADER.exec(line);
        if (!header) {
            if (line.trim() && !SUMMARY.test(line.trim()) && !NOTE.test(line))
                unparsed.push(line);
            index++;
            continue;
        }
        const reportedFile = header[1].split(/[\\/]/).pop() ?? header[1];
        const inFile = reportedFile === file;
        const details: string[] = [];
        let column = 1;
        index++;
        while (index < lines.length && !HEADER.test(lines[index]) && !SUMMARY.test(lines[index].trim())) {
            const current = lines[index];
            if (/^\s*\^\s*$/.test(current)) {
                column = current.indexOf('^') + 1;
                index++;
                continue;
            }
            const detail = /^\s+(symbol|location|required|found|reason|where|constructor|method|class|note|caused by)\s*:\s*(.*)$/i.exec(current);
            if (detail)
                details.push(`${detail[1]}: ${detail[2].trim()}`);
            index++;
        }
        diagnostics.push({
            severity: header[3] === 'error' ? 'error' : 'warning',
            message: [header[4].trim() + (inFile ? '' : ` (em ${reportedFile})`), ...details].join('\n'),
            line: inFile ? Number(header[2]) : 1,
            column: inFile ? column : 1,
            source: 'Java',
        });
    }
    if (unparsed.length > 0 && diagnostics.length === 0) {
        diagnostics.push({ severity: 'error', message: `O javac respondeu:\n${unparsed.join('\n')}`, line: 1, column: 1, code: 'toolchain', source: 'Java' });
    }
    return diagnostics;
}
