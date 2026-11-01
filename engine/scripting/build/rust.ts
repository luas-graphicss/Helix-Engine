import 'server-only';
import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { run } from './process';
import { parseRustcJson } from './rust-diagnostics';
import { RUST_TARGET, toolchain, type RustToolchain } from './toolchains';
import { cacheDir, hashOf, sdkSourceDir, withWorkspace } from './workspace';
export interface RustBuildOutput {
    readonly ok: boolean;
    readonly wasm: Uint8Array | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
const EDITION = '2024';
const BUILD_TIMEOUT = 120000;
const COMMON_FLAGS = ['--edition', EDITION, '--target', RUST_TARGET, '-C', 'opt-level=2', '-C', 'panic=abort', '-C', 'debuginfo=0'];
export async function buildRust(file: string, source: string): Promise<RustBuildOutput> {
    const rust = await toolchain('rust');
    const sdk = await sdkLibrary(rust);
    return withWorkspace('rust', async (dir) => {
        await writeFile(path.join(dir, file), source, 'utf8');
        const output = `${stem(file)}.wasm`;
        const result = await run(rust.rustc, [
            ...COMMON_FLAGS,
            '--crate-type',
            'cdylib',
            '--crate-name',
            crateName(file),
            '-C',
            'strip=debuginfo',
            '-C',
            'link-arg=--export=__stack_pointer',
            '-C',
            'link-arg=--stack-first',
            '--extern',
            `helix=${sdk}`,
            '--error-format=json',
            '-o',
            output,
            file,
        ], { cwd: dir, env: rust.env, timeoutMs: BUILD_TIMEOUT });
        const diagnostics = parseRustcJson(result.stderr, file);
        if (result.timedOut)
            diagnostics.push(toolchainError('O rustc demorou demais e foi interrompido; simplifique o script ou tente de novo.'));
        const failed = result.code !== 0 || diagnostics.some((diagnostic) => diagnostic.severity === 'error');
        if (failed) {
            if (result.code !== 0 && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
                diagnostics.push(toolchainError(`O rustc terminou com código ${result.code ?? result.signal}:\n${result.stderr.trim() || result.stdout.trim() || 'sem saída'}`));
            }
            return { ok: false, wasm: null, diagnostics, toolchain: rust.version };
        }
        const wasm = new Uint8Array(await readFile(path.join(dir, output)));
        return { ok: true, wasm, diagnostics, toolchain: rust.version };
    });
}
async function sdkLibrary(rust: RustToolchain): Promise<string> {
    const sourceFile = path.join(sdkSourceDir('rust'), 'helix.rs');
    const source = await readFile(sourceFile, 'utf8');
    const key = hashOf('rlib-v1', rust.version, EDITION, COMMON_FLAGS.join(' '), source);
    const dir = await cacheDir('rust', key);
    const target = path.join(dir, 'libhelix.rlib');
    try {
        await access(target);
        return target;
    }
    catch {
    }
    await withWorkspace('rust', async (work) => {
        await writeFile(path.join(work, 'helix.rs'), source, 'utf8');
        const result = await run(rust.rustc, [...COMMON_FLAGS, '--crate-type', 'rlib', '--crate-name', 'helix', '-o', 'libhelix.rlib', 'helix.rs'], { cwd: work, env: rust.env, timeoutMs: BUILD_TIMEOUT });
        if (result.code !== 0)
            throw new Error(`o SDK Rust da engine não compilou com ${rust.version}:\n${result.stderr.trim()}`);
        await rename(path.join(work, 'libhelix.rlib'), target).catch(async (cause: NodeJS.ErrnoException) => {
            if (cause.code !== 'EEXIST' && cause.code !== 'ENOTEMPTY')
                throw cause;
        });
    });
    return target;
}
export function stem(file: string): string {
    return file.replace(/\.[^.]+$/, '');
}
export function crateName(file: string): string {
    const base = stem(file)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_]/g, '_')
        .toLowerCase();
    return /^[0-9]/.test(base) ? `_${base}` : base || 'script';
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Rust' };
}
