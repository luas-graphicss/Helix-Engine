import 'server-only';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { run } from './process';
import { parseSwiftcOutput } from './swift-diagnostics';
import { toolchain } from './toolchains';
import { sdkSourceDir, withWorkspace } from './workspace';
export interface SwiftBuildOutput {
    readonly ok: boolean;
    readonly wasm: Uint8Array | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
const BUILD_TIMEOUT = 180000;
const MODULE_NAME = 'HelixScript';
const SDK_FILE = '__HelixSDK.swift';
const BOOT_FILE = '__HelixBoot.swift';
export async function buildSwift(file: string, source: string): Promise<SwiftBuildOutput> {
    const swift = await toolchain('swift');
    const sdk = await readFile(path.join(sdkSourceDir('swift'), 'Helix.swift'), 'utf8');
    const scan = scanSwift(source);
    const diagnostics: CompileDiagnostic[] = [...scan.warnings];
    return withWorkspace('swift', async (dir) => {
        await Promise.all([writeFile(path.join(dir, file), source, 'utf8'), writeFile(path.join(dir, SDK_FILE), sdk, 'utf8'), writeFile(path.join(dir, BOOT_FILE), bootSource(scan), 'utf8')]);
        const output = `${file.replace(/\.[^.]+$/, '')}.wasm`;
        const result = await run(swift.swiftc, [
            '-target',
            swift.target,
            '-sdk',
            swift.sysroot,
            '-resource-dir',
            swift.resourceDir,
            '-static-stdlib',
            '-O',
            '-wmo',
            '-parse-as-library',
            '-swift-version',
            '5',
            '-diagnostic-style',
            'llvm',
            '-module-name',
            MODULE_NAME,
            '-enable-experimental-feature',
            'Extern',
            '-Xclang-linker',
            '-mexec-model=reactor',
            '-Xclang-linker',
            '-resource-dir',
            '-Xclang-linker',
            swift.clangResourceDir,
            '-Xlinker',
            '--export=__stack_pointer',
            '-Xlinker',
            '-z',
            '-Xlinker',
            'stack-size=1048576',
            '-Xlinker',
            '--strip-all',
            '-o',
            output,
            SDK_FILE,
            file,
            BOOT_FILE,
        ], { cwd: dir, timeoutMs: BUILD_TIMEOUT });
        diagnostics.push(...parseSwiftcOutput(result.stderr, file));
        if (result.timedOut)
            diagnostics.push(toolchainError('O swiftc demorou demais e foi interrompido; simplifique o script ou tente de novo.'));
        const failed = result.code !== 0 || diagnostics.some((diagnostic) => diagnostic.severity === 'error');
        if (failed) {
            if (result.code !== 0 && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
                diagnostics.push(toolchainError(`O swiftc terminou com código ${result.code ?? result.signal}:\n${result.stderr.trim() || result.stdout.trim() || 'sem saída'}`));
            }
            return { ok: false, wasm: null, diagnostics, toolchain: swift.version };
        }
        const wasm = new Uint8Array(await readFile(path.join(dir, output)));
        return { ok: true, wasm, diagnostics, toolchain: swift.version };
    });
}
interface SwiftParam {
    readonly label: string | null;
    readonly type: string;
}
interface SwiftFunction {
    readonly name: string;
    readonly params: readonly SwiftParam[];
    readonly returns: string | null;
}
export interface SwiftScan {
    readonly scriptClass: string | null;
    readonly hooks: readonly SwiftFunction[];
    readonly exports: readonly SwiftFunction[];
    readonly warnings: readonly CompileDiagnostic[];
}
const HOOK_SIGNATURES: Record<string, {
    readonly params: readonly ('number' | 'value')[];
    readonly returns?: 'value';
}> = {
    onLoad: { params: [] },
    onStart: { params: [] },
    onUpdate: { params: ['number'] },
    onFixedUpdate: { params: ['number'] },
    onLateUpdate: { params: ['number'] },
    onRender: { params: ['value'] },
    onEnable: { params: [] },
    onDisable: { params: [] },
    onStop: { params: [] },
    onDestroy: { params: [] },
    onBeforeHotReload: { params: [], returns: 'value' },
    onHotReload: { params: ['value'] },
    onCollisionBegin: { params: ['value', 'value'] },
    onCollisionStay: { params: ['value', 'value'] },
    onCollisionEnd: { params: ['value'] },
    onTriggerEnter: { params: ['value'] },
    onTriggerStay: { params: ['value'] },
    onTriggerExit: { params: ['value'] },
};
const SCRIPT_CLASS = /\bclass\s+([A-Za-z_]\w*)\s*(?:<[^>{]*>)?\s*:\s*[^{\n]*?\b(?:Helix\.)?Script\b[^{\n]*\{/;
const OVERRIDE_HOOK = /\boverride\s+func\s+(on[A-Z]\w*)\s*\(([^)]*)\)/g;
const TOP_LEVEL_FUNCTION = /^(?:(public|open|internal|private|fileprivate)\s+)?(?:(?:static|final|nonisolated|@\w+)\s+)*func\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*((?:(?:throws|rethrows|async)\s*)*)(?:->\s*([^{\n]+?))?\s*\{/gm;
export function scanSwift(source: string): SwiftScan {
    const body = stripSwiftComments(source);
    const warnings: CompileDiagnostic[] = [];
    const scriptClass = SCRIPT_CLASS.exec(body)?.[1] ?? null;
    const hooks: SwiftFunction[] = [];
    const exports: SwiftFunction[] = [];
    const seen = new Set<string>();
    if (scriptClass) {
        for (const match of body.matchAll(OVERRIDE_HOOK)) {
            const name = match[1];
            if (!(name in HOOK_SIGNATURES) || seen.has(name))
                continue;
            seen.add(name);
            hooks.push({ name, params: parseParams(match[2]), returns: null });
        }
    }
    for (const match of body.matchAll(TOP_LEVEL_FUNCTION)) {
        const [, access, name, params, effects, returns] = match;
        if (effects.trim()) {
            warnings.push(warning(`a função ${name} não foi exportada: funções throws/async não atravessam a fronteira com a engine.`, lineOf(source, match.index ?? 0)));
            continue;
        }
        const fn: SwiftFunction = { name, params: parseParams(params), returns: returns?.trim() || null };
        if (name in HOOK_SIGNATURES) {
            if (!scriptClass && !seen.has(name)) {
                seen.add(name);
                hooks.push(fn);
            }
            continue;
        }
        if (access !== 'public' && access !== 'open')
            continue;
        const unsupported = [...fn.params.map((param) => param.type), ...(fn.returns ? [fn.returns] : [])].find((type) => !(normalizeType(type) in ABI));
        if (unsupported) {
            warnings.push(warning(`a função ${name} não foi exportada: o tipo ${unsupported} não atravessa a fronteira com a engine (use Double, Float, Int, Bool, String, Value ou Vec3).`, lineOf(source, match.index ?? 0)));
            continue;
        }
        exports.push(fn);
    }
    return { scriptClass, hooks, exports, warnings };
}
function parseParams(text: string): SwiftParam[] {
    const params: SwiftParam[] = [];
    for (const part of splitTopLevel(text)) {
        const match = /^\s*(?:(\w+)\s+)?(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(part);
        if (!match)
            continue;
        const [, external, internal, type] = match;
        const label = external ? (external === '_' ? null : external) : internal;
        params.push({ label, type: type.trim() });
    }
    return params;
}
function splitTopLevel(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of text) {
        if (char === '(' || char === '[' || char === '<')
            depth++;
        else if (char === ')' || char === ']' || char === '>')
            depth--;
        if (char === ',' && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim())
        parts.push(current);
    return parts;
}
function stripSwiftComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, '');
}
function lineOf(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < source.length; i++)
        if (source.charCodeAt(i) === 10)
            line++;
    return line;
}
interface AbiType {
    readonly raw: string;
    from(arg: string): string;
    to(result: string): string;
}
const ABI: Record<string, AbiType> = {
    Double: { raw: 'Double', from: (a) => a, to: (r) => r },
    Float: { raw: 'Float', from: (a) => a, to: (r) => r },
    Int: { raw: 'Int32', from: (a) => `Int(${a})`, to: (r) => `Int32(truncatingIfNeeded: ${r})` },
    Int32: { raw: 'Int32', from: (a) => a, to: (r) => r },
    UInt32: { raw: 'UInt32', from: (a) => a, to: (r) => r },
    Bool: { raw: 'Int32', from: (a) => `(${a} != 0)`, to: (r) => `(${r} ? 1 : 0)` },
    String: { raw: 'UInt32', from: (a) => `Value(adopting: ${a}).string`, to: (r) => `${r}.value.intoRaw()` },
    Value: { raw: 'UInt32', from: (a) => `Value(adopting: ${a})`, to: (r) => `${r}.intoRaw()` },
    Vec3: { raw: 'UInt32', from: (a) => `Value(adopting: ${a}).vec3`, to: (r) => `${r}.value.intoRaw()` },
};
function normalizeType(type: string): string {
    return type.trim().replace(/^Helix\./, '').replace(/^Swift\./, '');
}
const HOOK_KIND: Record<'number' | 'value', string> = { number: 'Double', value: 'Value' };
export function bootSource(scan: SwiftScan): string {
    const lines: string[] = ['// Gerado pelo serviço de build da Helix Engine: as pontes entre a engine e o script.', ''];
    if (scan.scriptClass)
        lines.push(`private let __hxScript: Script = ${scan.scriptClass}()`, '');
    for (const hook of scan.hooks) {
        const signature = HOOK_SIGNATURES[hook.name];
        const params = signature.params.map((kind, index) => ({ label: hook.params[index]?.label ?? null, type: HOOK_KIND[kind] }));
        const target = scan.scriptClass ? `__hxScript.${hook.name}` : hook.name;
        lines.push(bridge(hook.name, `__hx_hook_${hook.name}`, params, signature.returns ? 'Value' : null, target, Boolean(scan.scriptClass)));
    }
    for (const fn of scan.exports) {
        const params = fn.params.map((param) => ({ label: param.label, type: normalizeType(param.type) }));
        lines.push(bridge(fn.name, `__hx_export_${fn.name}`, params, fn.returns ? normalizeType(fn.returns) : null, fn.name, false));
    }
    lines.push('');
    return lines.join('\n');
}
function bridge(exportName: string, symbol: string, params: readonly {
    label: string | null;
    type: string;
}[], returns: string | null, target: string, method: boolean): string {
    const rawParams = params.map((param, index) => `_ a${index}: ${ABI[param.type].raw}`).join(', ');
    const args = params.map((param, index) => `${!method && param.label ? `${param.label}: ` : ''}${ABI[param.type].from(`a${index}`)}`);
    const call = `${target}(${args.join(', ')})`;
    const rawReturn = returns ? ` -> ${ABI[returns].raw}` : '';
    const body = returns ? ABI[returns].to(call) : call;
    return `@_expose(wasm, "${exportName}") @_cdecl("${symbol}") func ${symbol}(${rawParams})${rawReturn} { ${body} }`;
}
function warning(message: string, line: number): CompileDiagnostic {
    return { severity: 'warning', message, line, column: 1, code: 'export', source: 'Swift' };
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Swift' };
}
