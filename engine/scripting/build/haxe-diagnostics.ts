import type { CompileDiagnostic } from '../compiler/compile-types';
const LOCATION = /^(.+?\.hx):(\d+): (?:characters? (\d+)(?:-(\d+))?|lines (\d+)-(\d+)) : (.*)$/;
const WARNING = /^Warning : (?:\((W\w+)\) )?(.*)$/;
const BARE = /^(Error|Warning|Uncaught exception|Fatal error): (.*)$/;
export interface HaxeDiagnostic extends CompileDiagnostic {
    readonly file: string;
    readonly reportedLine: number;
}
export function parseHaxeOutput(output: string, file: string, options: {
    readonly failed: boolean;
}): HaxeDiagnostic[] {
    const diagnostics: HaxeDiagnostic[] = [];
    const unparsed: string[] = [];
    for (const raw of output.split('\n')) {
        const line = raw.replace(/\r$/, '');
        if (!line.trim())
            continue;
        const location = LOCATION.exec(line);
        if (!location) {
            const bare = BARE.exec(line.trim());
            if (bare)
                diagnostics.push({ severity: bare[1] === 'Warning' ? 'warning' : 'error', message: bare[2].trim(), line: 1, column: 1, code: 'toolchain', source: 'Haxe', file: '', reportedLine: 0 });
            else
                unparsed.push(line);
            continue;
        }
        const reportedFile = location[1].split(/[\\/]/).pop() ?? location[1];
        const reportedLine = Number(location[2]);
        const inFile = reportedFile === file;
        let text = location[7].trim();
        const previous = diagnostics[diagnostics.length - 1];
        if (text.startsWith('...')) {
            if (previous && previous.file === reportedFile && previous.reportedLine === reportedLine) {
                diagnostics[diagnostics.length - 1] = { ...previous, message: `${previous.message}\n${text.replace(/^\.\.\.\s*/, '')}` };
            }
            continue;
        }
        let severity: CompileDiagnostic['severity'] = 'error';
        let code: string | undefined;
        const warning = WARNING.exec(text);
        if (warning) {
            severity = 'warning';
            code = warning[1];
            text = warning[2].trim();
        }
        const startColumn = location[3] ? Number(location[3]) : 1;
        const endColumn = location[4] ? Number(location[4]) : undefined;
        const endLine = location[6] ? Number(location[6]) : undefined;
        diagnostics.push({
            severity,
            message: inFile ? text : `${text} (em ${reportedFile})`,
            line: inFile ? reportedLine : 1,
            column: inFile ? startColumn : 1,
            ...(inFile && endLine !== undefined ? { endLine } : {}),
            ...(inFile && endColumn !== undefined ? { endColumn } : {}),
            ...(code ? { code } : {}),
            source: 'Haxe',
            file: reportedFile,
            reportedLine,
        });
    }
    if (options.failed && unparsed.length > 0 && diagnostics.length === 0) {
        diagnostics.push({ severity: 'error', message: `O compilador Haxe respondeu:\n${unparsed.join('\n')}`, line: 1, column: 1, code: 'toolchain', source: 'Haxe', file: '', reportedLine: 0 });
    }
    return diagnostics;
}
