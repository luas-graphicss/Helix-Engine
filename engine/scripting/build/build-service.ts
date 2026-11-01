import 'server-only';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { NATIVE_BUILD_LANGUAGES, type NativeArtifactInfo, type NativeBuildLanguage, type NativeBuildMeta, type NativeBuildRequest, type NativeBuildStatus, type NativeToolchainStatus } from '../languages/native/build-protocol';
import { buildDart } from './dart';
import { buildGo } from './go';
import { buildHaxe } from './haxe';
import { buildJava } from './java';
import { buildKotlin } from './kotlin';
import { buildRust } from './rust';
import { buildSwift } from './swift';
import { buildZig } from './zig';
import { toolchain } from './toolchains';
import { hashOf, readCachedArtifact, writeCachedArtifact } from './workspace';
export interface BuildResult {
    readonly meta: NativeBuildMeta;
    readonly artifact: Uint8Array | null;
}
const LABEL: Record<NativeBuildLanguage, string> = { rust: 'Rust', go: 'Go', zig: 'Zig', java: 'Java', kotlin: 'Kotlin', swift: 'Swift', dart: 'Dart', haxe: 'Haxe' };
const ARTIFACT_CACHE_VERSION = 'artifact-v2';
const MAX_CONCURRENT_BUILDS = 2;
export async function buildStatus(): Promise<NativeBuildStatus> {
    const toolchains = await Promise.all(NATIVE_BUILD_LANGUAGES.map(describeToolchain));
    return { toolchains };
}
async function describeToolchain(language: NativeBuildLanguage): Promise<NativeToolchainStatus> {
    try {
        const found = await toolchain(language);
        return { language, available: true, version: found.version, detail: '' };
    }
    catch (cause) {
        return { language, available: false, version: null, detail: describe(cause) };
    }
}
export async function build(request: NativeBuildRequest): Promise<BuildResult> {
    const started = performance.now();
    let version: string;
    try {
        version = (await toolchain(request.language)).version;
    }
    catch (cause) {
        return { meta: failure(request.language, `toolchain indisponível: ${describe(cause)}`, 'toolchain', started), artifact: null };
    }
    const siblings = request.siblings ?? [];
    const key = hashOf(ARTIFACT_CACHE_VERSION, request.language, version, request.file, request.source, ...siblings.flatMap((sibling) => [sibling.file, sibling.source]));
    const cached = await readCachedArtifact(request.language, key);
    if (cached)
        return { meta: { ...cached.meta, durationMs: performance.now() - started }, artifact: cached.bytes };
    const result = await withBuildSlot(() => compile(request, version, started));
    await writeCachedArtifact(request.language, key, { meta: result.meta, bytes: result.artifact }).catch(() => undefined);
    return result;
}
async function compile(request: NativeBuildRequest, version: string, started: number): Promise<BuildResult> {
    try {
        switch (request.language) {
            case 'rust': {
                const output = await buildRust(request.file, request.source);
                return finish(output.ok, output.diagnostics, output.wasm, output.wasm ? { kind: 'wasm' } : null, output.toolchain, started);
            }
            case 'go': {
                const output = await buildGo(request.file, request.source);
                return finish(output.ok, output.diagnostics, output.wasm, output.wasm ? { kind: 'wasm' } : null, output.toolchain, started);
            }
            case 'java': {
                const output = await buildJava(request.file, request.source, request.siblings ?? []);
                const bytes = output.js !== null ? new TextEncoder().encode(output.js) : null;
                const info: NativeArtifactInfo | null = bytes ? { kind: 'js', ...(output.sourceMap ? { sourceMap: output.sourceMap } : {}) } : null;
                return finish(output.ok, output.diagnostics, bytes, info, output.toolchain, started);
            }
            case 'kotlin': {
                const output = await buildKotlin(request.file, request.source, request.siblings ?? []);
                const bytes = output.js !== null ? new TextEncoder().encode(output.js) : null;
                const info: NativeArtifactInfo | null = bytes ? { kind: 'js', ...(output.sourceMap ? { sourceMap: output.sourceMap } : {}) } : null;
                return finish(output.ok, output.diagnostics, bytes, info, output.toolchain, started);
            }
            case 'swift': {
                const output = await buildSwift(request.file, request.source);
                return finish(output.ok, output.diagnostics, output.wasm, output.wasm ? { kind: 'wasm' } : null, output.toolchain, started);
            }
            case 'zig': {
                const output = await buildZig(request.file, request.source);
                return finish(output.ok, output.diagnostics, output.wasm, output.wasm ? { kind: 'wasm' } : null, output.toolchain, started);
            }
            case 'dart': {
                const output = await buildDart(request.file, request.source, request.siblings ?? []);
                const bytes = output.js !== null ? new TextEncoder().encode(output.js) : null;
                const info: NativeArtifactInfo | null = bytes ? { kind: 'js', ...(output.sourceMap ? { sourceMap: output.sourceMap } : {}) } : null;
                return finish(output.ok, output.diagnostics, bytes, info, output.toolchain, started);
            }
            case 'haxe': {
                const output = await buildHaxe(request.file, request.source, request.siblings ?? []);
                const bytes = output.js !== null ? new TextEncoder().encode(output.js) : null;
                const info: NativeArtifactInfo | null = bytes ? { kind: 'js', ...(output.sourceMap ? { sourceMap: output.sourceMap } : {}) } : null;
                return finish(output.ok, output.diagnostics, bytes, info, output.toolchain, started);
            }
        }
    }
    catch (cause) {
        return { meta: failure(request.language, `o serviço de build falhou: ${describe(cause)}`, 'build-service', started, version), artifact: null };
    }
}
function finish(ok: boolean, diagnostics: readonly CompileDiagnostic[], artifact: Uint8Array | null, info: NativeArtifactInfo | null, toolchainVersion: string, started: number): BuildResult {
    return {
        meta: { ok, diagnostics, artifact: ok ? info : null, toolchain: toolchainVersion, durationMs: performance.now() - started, cached: false },
        artifact: ok ? artifact : null,
    };
}
function failure(language: NativeBuildLanguage, message: string, code: string, started: number, toolchainVersion = 'indisponível'): NativeBuildMeta {
    const diagnostic: CompileDiagnostic = { severity: 'error', message, line: 1, column: 1, code, source: LABEL[language] };
    return { ok: false, diagnostics: [diagnostic], artifact: null, toolchain: toolchainVersion, durationMs: performance.now() - started, cached: false };
}
function describe(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
let active = 0;
const waiting: Array<() => void> = [];
async function withBuildSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= MAX_CONCURRENT_BUILDS)
        await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
        return await fn();
    }
    finally {
        active--;
        waiting.shift()?.();
    }
}
