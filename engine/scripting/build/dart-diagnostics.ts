import type { CompileDiagnostic } from '../compiler/compile-types';
const LOCATION = /^(.+?\.dart):(\d+):(\d+):\s*(?:(Error|Warning|Info|Context): (.*))?$/;
const SEVERITY = /^(Error|Warning|Info|Context): (.*)$/;
const BARE = /^(Error|Warning|Internal Error|Unhandled exception): (.*)$/;
const CARET = /^\s*\^+\s*$/;
const REDUNDANT = /^Compilation failed/;
const LOCAL_PATH = / \('[^']*'\)/g;
export interface DartDiagnostic extends CompileDiagnostic {
    readonly file: string;
    readonly reportedLine: number;
}
export function parseDartOutput(output: string, file: string, options: {
    readonly failed: boolean;
}): DartDiagnostic[] {
    const diagnostics: DartDiagnostic[] = [];
    const lines = output.split('\n').map((line) => line.replace(/\r$/, ''));
    const unparsed: string[] = [];
    const isHeader = (line: string): boolean => LOCATION.test(line) || BARE.test(line.trim());
    let index = 0;
    while (index < lines.length) {
        const location = LOCATION.exec(lines[index]);
        if (!location) {
            const bare = BARE.exec(lines[index].trim());
            if (bare) {
                if (!REDUNDANT.test(bare[2].trim()))
                    diagnostics.push({ severity: bare[1] === 'Warning' ? 'warning' : 'error', message: bare[2].trim(), line: 1, column: 1, code: 'toolchain', source: 'Dart', file: '', reportedLine: 0 });
            }
            else if (lines[index].trim()) {
                unparsed.push(lines[index]);
            }
            index++;
            continue;
        }
        index++;
        let severity = location[4] ?? null;
        let headline = location[5] ?? null;
        if (severity === null && index < lines.length) {
            const next = SEVERITY.exec(lines[index]);
            if (next) {
                severity = next[1];
                headline = next[2];
                index++;
            }
        }
        const block: string[] = [];
        while (index < lines.length && !isHeader(lines[index])) {
            block.push(lines[index]);
            index++;
        }
        if (severity === null || headline === null || severity === 'Info' || severity === 'Context')
            continue;
        const caret = block.findIndex((line) => CARET.test(line));
        const notes = (caret >= 0 ? [...block.slice(0, Math.max(0, caret - 1)), ...block.slice(caret + 1)] : block).map((line) => line.trim().replace(LOCAL_PATH, '')).filter((line) => /^(- |Try |Consider )/.test(line));
        const reportedFile = location[1].split(/[\\/]/).pop() ?? location[1];
        const inFile = reportedFile === file;
        diagnostics.push({
            severity: severity === 'Error' ? 'error' : 'warning',
            message: [headline.trim(), ...notes].join('\n') + (inFile ? '' : ` (em ${reportedFile})`),
            line: inFile ? Number(location[2]) : 1,
            column: inFile ? Number(location[3]) : 1,
            source: 'Dart',
            file: reportedFile,
            reportedLine: Number(location[2]),
        });
    }
    if (options.failed && unparsed.length > 0 && diagnostics.length === 0) {
        diagnostics.push({ severity: 'error', message: `O dart2js respondeu:\n${unparsed.join('\n')}`, line: 1, column: 1, code: 'toolchain', source: 'Dart', file: '', reportedLine: 0 });
    }
    return diagnostics;
}
