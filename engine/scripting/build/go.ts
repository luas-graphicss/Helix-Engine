import 'server-only';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { run } from './process';
import { toolchain } from './toolchains';
import { sdkSourceDir, withWorkspace } from './workspace';
export interface GoBuildOutput {
    readonly ok: boolean;
    readonly wasm: Uint8Array | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
const BUILD_TIMEOUT = 180000;
const GO_MIN_VERSION = '1.24';
export async function buildGo(file: string, source: string): Promise<GoBuildOutput> {
    const go = await toolchain('go');
    return withWorkspace('go', async (dir) => {
        await writeFile(path.join(dir, 'go.mod'), goMod(sdkSourceDir('go')), 'utf8');
        await writeFile(path.join(dir, file), source, 'utf8');
        const output = `${file.replace(/\.[^.]+$/, '')}.wasm`;
        const result = await run(go.go, ['build', '-buildmode=c-shared', '-trimpath', '-ldflags=-s -w', '-o', output, '.'], { cwd: dir, env: go.env, timeoutMs: BUILD_TIMEOUT });
        const diagnostics = parseGoOutput(result.stderr, file);
        if (result.timedOut)
            diagnostics.push(toolchainError('O compilador Go demorou demais e foi interrompido; tente de novo (a primeira compilação prepara a biblioteca padrão).'));
        if (result.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
                diagnostics.push(toolchainError(`O go build terminou com código ${result.code ?? result.signal}:\n${result.stderr.trim() || result.stdout.trim() || 'sem saída'}`));
            }
            return { ok: false, wasm: null, diagnostics, toolchain: go.version };
        }
        const wasm = new Uint8Array(await readFile(path.join(dir, output)));
        return { ok: true, wasm, diagnostics, toolchain: go.version };
    });
}
function goMod(sdkDir: string): string {
    return `module script\n\ngo ${GO_MIN_VERSION}\n\nrequire helix v0.0.0\n\nreplace helix => ${sdkDir}\n`;
}
const GO_DIAGNOSTIC = /^(?:\.\/)?([^:\s]+\.go):(\d+)(?::(\d+))?: (.*)$/;
const GO_SKIPPED = [/^# /, /^too many errors$/, /^note: module requires Go/, /^go: downloading/];
export function parseGoOutput(stderr: string, file: string): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const unparsed: string[] = [];
    for (const raw of stderr.split('\n')) {
        const line = raw.replace(/\r$/, '');
        if (!line.trim())
            continue;
        const match = GO_DIAGNOSTIC.exec(line.trim());
        if (match) {
            const inFile = path.basename(match[1]) === file;
            const where = inFile ? '' : ` (em ${match[1]})`;
            diagnostics.push({
                severity: 'error',
                message: `${match[4].trim()}${where}`,
                line: inFile ? Number(match[2]) : 1,
                column: inFile && match[3] ? Number(match[3]) : 1,
                source: 'Go',
            });
            continue;
        }
        if (/^\s/.test(line) && diagnostics.length > 0) {
            const last = diagnostics[diagnostics.length - 1];
            diagnostics[diagnostics.length - 1] = { ...last, message: `${last.message}\n${line.trim()}` };
            continue;
        }
        if (GO_SKIPPED.some((pattern) => pattern.test(line.trim())))
            continue;
        unparsed.push(line.trim());
    }
    if (unparsed.length > 0 && diagnostics.length === 0)
        diagnostics.push(toolchainError(`O compilador Go respondeu:\n${unparsed.join('\n')}`));
    return diagnostics;
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Go' };
}
