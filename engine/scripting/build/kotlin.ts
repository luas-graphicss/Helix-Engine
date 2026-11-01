import 'server-only';
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { restrictSourceMapTo } from './java-source-map';
import { parseKotlincOutput } from './kotlinc-diagnostics';
import { run } from './process';
import { toolchain, type KotlinToolchain } from './toolchains';
import { cacheDir, hashOf, sdkSourceDir, withWorkspace } from './workspace';
export interface KotlinBuildOutput {
    readonly ok: boolean;
    readonly js: string | null;
    readonly sourceMap: string | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
export interface KotlinSibling {
    readonly file: string;
    readonly source: string;
}
const KOTLINC_TIMEOUT = 180000;
const COMPILER_MAIN = 'org.jetbrains.kotlin.cli.js.K2JSCompiler';
const JVM_FLAGS = ['-Xmx1g', '-Xss4m', '-Xshare:auto', '-XX:TieredStopAtLevel=1', '-XX:+UseSerialGC'];
const COMMON_FLAGS = ['-opt-in=kotlin.js.ExperimentalJsExport'];
const BOOT_FILE = 'HelixBoot.kt';
const BOOT_EXPORT = '__helixCreate';
const HOOK_NAMES = ['onLoad', 'onStart', 'onUpdate', 'onFixedUpdate', 'onLateUpdate', 'onRender', 'onEnable', 'onDisable', 'onStop', 'onDestroy', 'onBeforeHotReload', 'onHotReload', 'onCollisionBegin', 'onCollisionStay', 'onCollisionEnd', 'onTriggerEnter', 'onTriggerStay', 'onTriggerExit'];
const PACKAGE = /^\s*package\s+([\w.]+)/m;
const SCRIPT_CLASS = /\bclass\s+(\w+)\s*(?:<[^>]*>)?\s*(?:(?:public|internal|private|protected)\s+)?(?:constructor\s*)?(\([^)]*\))?\s*:\s*(?:helix\.)?Script\s*\(/;
const HOOK_DECLARATION = /\boverride\s+fun\s+(on[A-Z]\w*)\s*\(/g;
export async function buildKotlin(file: string, source: string, siblings: readonly KotlinSibling[] = []): Promise<KotlinBuildOutput> {
    const kotlin = await toolchain('kotlin');
    const sdk = await sdkKlib(kotlin);
    const compileFile = kotlinFileFor(file);
    const libraries = [kotlin.stdlib, sdk].join(path.delimiter);
    const compiler = [...JVM_FLAGS, '-cp', kotlin.compilerClasspath.join(path.delimiter), COMPILER_MAIN, ...COMMON_FLAGS];
    return withWorkspace('kotlin', async (dir) => {
        const src = path.join(dir, 'src');
        const out = path.join(dir, 'out');
        await Promise.all([mkdir(src), mkdir(out)]);
        await writeFile(path.join(src, compileFile), source, 'utf8');
        for (const sibling of siblings) {
            const siblingFile = kotlinFileFor(sibling.file);
            if (sibling.file !== file && siblingFile !== compileFile && siblingFile !== BOOT_FILE)
                await writeFile(path.join(src, siblingFile), sibling.source, 'utf8');
        }
        const boot = bootSource(source);
        await writeFile(path.join(src, BOOT_FILE), boot.code, 'utf8');
        const sources = (await readdir(src)).filter((name) => name.endsWith('.kt')).map((name) => path.join('src', name));
        const compiled = await run(kotlin.java, [...compiler, '-ir-output-dir', 'klib', '-ir-output-name', 'script', '-libraries', libraries, ...sources], { cwd: dir, timeoutMs: KOTLINC_TIMEOUT });
        const diagnostics = translateBootErrors(parseKotlincOutput(`${compiled.stderr}\n${compiled.stdout}`, compileFile), boot.scriptClass);
        if (compiled.timedOut)
            diagnostics.push(toolchainError('O kotlinc demorou demais e foi interrompido; tente de novo.'));
        if (compiled.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
                diagnostics.push(toolchainError(`O kotlinc terminou com código ${compiled.code ?? compiled.signal}:\n${compiled.stderr.trim() || 'sem saída'}`));
            return { ok: false, js: null, sourceMap: null, diagnostics, toolchain: kotlin.version };
        }
        const linked = await run(kotlin.java, [...compiler, '-Xir-produce-js', '-Xir-dce', `-Xinclude=${path.join('klib', 'script.klib')}`, '-ir-output-dir', 'out', '-ir-output-name', 'script', '-module-kind', 'commonjs', '-main', 'noCall', '-source-map', '-source-map-embed-sources=never', '-libraries', libraries], {
            cwd: dir,
            timeoutMs: KOTLINC_TIMEOUT,
        });
        diagnostics.push(...parseKotlincOutput(`${linked.stderr}\n${linked.stdout}`, compileFile));
        if (linked.timedOut)
            diagnostics.push(toolchainError('A geração do JavaScript demorou demais e foi interrompida; tente de novo.'));
        if (linked.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
                diagnostics.push(toolchainError(`A geração do JavaScript terminou com código ${linked.code ?? linked.signal}:\n${linked.stderr.trim() || linked.stdout.trim() || 'sem saída'}`));
            return { ok: false, js: null, sourceMap: null, diagnostics, toolchain: kotlin.version };
        }
        const [js, map] = await Promise.all([readFile(path.join(out, 'script.js'), 'utf8'), readFile(path.join(out, 'script.js.map'), 'utf8').catch(() => null)]);
        return {
            ok: true,
            js: wrapModule(js, boot.hasScript),
            sourceMap: map ? restrictSourceMapTo(map, compileFile) : null,
            diagnostics,
            toolchain: kotlin.version,
        };
    });
}
export function kotlinFileFor(file: string): string {
    const stem = file
        .replace(/\.[^.]+$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_]/g, '_');
    return `${/^[0-9]/.test(stem) ? `_${stem}` : stem || 'Script'}.kt`;
}
function bootSource(source: string): {
    code: string;
    hasScript: boolean;
    scriptClass: string | null;
} {
    const clean = stripComments(source);
    const pkg = PACKAGE.exec(clean)?.[1] ?? null;
    const scriptClass = SCRIPT_CLASS.exec(clean)?.[1] ?? null;
    const hooks = new Set<string>();
    for (const match of clean.matchAll(HOOK_DECLARATION))
        if (HOOK_NAMES.includes(match[1]))
            hooks.add(match[1]);
    const qualified = scriptClass ? (pkg ? `${pkg}.${scriptClass}` : scriptClass) : null;
    const body = qualified ? `@JsExport\nfun ${BOOT_EXPORT}(inject: dynamic): dynamic = helix.Runtime.boot(${qualified}(), inject, "${Array.from(hooks).join(',')}")\n` : '';
    return {
        code: `@file:Suppress("unused", "UNUSED_PARAMETER")\n\n${body}`,
        hasScript: qualified !== null,
        scriptClass,
    };
}
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
function translateBootErrors(diagnostics: ReturnType<typeof parseKotlincOutput>, scriptClass: string | null): CompileDiagnostic[] {
    return diagnostics.map(({ file, ...diagnostic }) => {
        if (file !== BOOT_FILE || !scriptClass)
            return diagnostic;
        const message = diagnostic.message.replace(/ \(em HelixBoot\.kt\)$/, '');
        return { ...diagnostic, message: `A engine não conseguiu instanciar a classe ${scriptClass} (ela precisa ser pública, não abstrata e ter um construtor sem parâmetros): ${message}` };
    });
}
function wrapModule(js: string, hasScript: boolean): string {
    const body = js.replace(/^\/\/# sourceMappingURL=.*$/m, '');
    if (!hasScript)
        return body;
    return `${body}\nconst ${BOOT_EXPORT} = module.exports.${BOOT_EXPORT};\ndelete module.exports.${BOOT_EXPORT};\nmodule.exports.default = function helixCreate(inject) { return ${BOOT_EXPORT}(inject); };\n`;
}
async function sdkKlib(kotlin: KotlinToolchain): Promise<string> {
    const dir = sdkSourceDir('kotlin');
    const files = (await readdir(dir)).filter((name) => name.endsWith('.kt')).sort();
    const sources = await Promise.all(files.map((name) => readFile(path.join(dir, name), 'utf8')));
    const key = hashOf('sdk-v1', kotlin.version, ...files, ...sources);
    const target = path.join(await cacheDir('kotlin', `sdk-${key}`), 'helix-sdk.klib');
    try {
        await access(target);
        return target;
    }
    catch {
    }
    await withWorkspace('kotlin', async (work) => {
        const result = await run(kotlin.java, [...JVM_FLAGS, '-cp', kotlin.compilerClasspath.join(path.delimiter), COMPILER_MAIN, ...COMMON_FLAGS, '-ir-output-dir', work, '-ir-output-name', 'helix-sdk', '-libraries', kotlin.stdlib, ...files.map((name) => path.join(dir, name))], {
            cwd: dir,
            timeoutMs: KOTLINC_TIMEOUT,
        });
        if (result.code !== 0)
            throw new Error(`o SDK Kotlin da engine não compilou com ${kotlin.version}:\n${result.stderr.trim()}`);
        await rm(target, { force: true }).catch(() => undefined);
        await rename(path.join(work, 'helix-sdk.klib'), target).catch(async (cause: NodeJS.ErrnoException) => {
            if (cause.code !== 'EEXIST')
                throw cause;
        });
    });
    return target;
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Kotlin' };
}
