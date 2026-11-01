import 'server-only';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { run } from './process';
import { toolchain, ZIG_TARGET } from './toolchains';
import { sdkSourceDir, withWorkspace } from './workspace';
import { parseZigOutput } from './zig-diagnostics';
export interface ZigBuildOutput {
    readonly ok: boolean;
    readonly wasm: Uint8Array | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
const BUILD_TIMEOUT = 180000;
const STACK_SIZE = 1 << 20;
const ROOT_FILE = 'main.zig';
const SDK_FILE = 'helix.zig';
const FALLBACK_FILE = 'script.zig';
const ROOT_SOURCE = ['const helix = @import("helix");', 'const script = @import("script");', '', 'pub const panic = helix.panic;', '', 'comptime {', '    helix.exportDecls(script);', '}', '', 'pub fn main() void {}', ''].join('\n');
export async function buildZig(file: string, source: string): Promise<ZigBuildOutput> {
    const zig = await toolchain('zig');
    const sdk = await readFile(path.join(sdkSourceDir('zig'), SDK_FILE), 'utf8');
    const writtenAs = [ROOT_FILE, SDK_FILE].includes(file.toLowerCase()) ? FALLBACK_FILE : file;
    return withWorkspace('zig', async (dir) => {
        await Promise.all([writeFile(path.join(dir, writtenAs), source, 'utf8'), writeFile(path.join(dir, SDK_FILE), sdk, 'utf8'), writeFile(path.join(dir, ROOT_FILE), ROOT_SOURCE, 'utf8')]);
        const output = `${moduleName(file)}.wasm`;
        const result = await run(zig.zig, [
            'build-exe',
            '-target',
            ZIG_TARGET,
            '-mexec-model=reactor',
            '-O',
            'ReleaseSafe',
            '-rdynamic',
            '--export=__stack_pointer',
            '--stack',
            String(STACK_SIZE),
            '--color',
            'off',
            '-freference-trace=12',
            '--global-cache-dir',
            zig.cacheDir,
            '--cache-dir',
            zig.cacheDir,
            '--name',
            moduleName(file),
            `-femit-bin=${output}`,
            '--dep',
            'helix',
            '--dep',
            'script',
            `-Mroot=${ROOT_FILE}`,
            '--dep',
            'helix',
            `-Mscript=${writtenAs}`,
            `-Mhelix=${SDK_FILE}`,
        ], { cwd: dir, env: zig.env, timeoutMs: BUILD_TIMEOUT });
        const diagnostics = parseZigOutput(result.stderr, { file, writtenAs, source });
        if (result.timedOut)
            diagnostics.push(toolchainError('O zig demorou demais e foi interrompido; simplifique o script ou tente de novo.'));
        const failed = result.code !== 0 || diagnostics.some((diagnostic) => diagnostic.severity === 'error');
        if (failed) {
            if (result.code !== 0 && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
                diagnostics.push(toolchainError(`O zig terminou com código ${result.code ?? result.signal}:\n${result.stderr.trim() || result.stdout.trim() || 'sem saída'}`));
            }
            return { ok: false, wasm: null, diagnostics, toolchain: zig.version };
        }
        const wasm = new Uint8Array(await readFile(path.join(dir, output)));
        return { ok: true, wasm, diagnostics, toolchain: zig.version };
    });
}
export function moduleName(file: string): string {
    const base = file
        .replace(/\.[^.]+$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_]/g, '_');
    return /^[0-9]/.test(base) ? `_${base}` : base || 'script';
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Zig' };
}
