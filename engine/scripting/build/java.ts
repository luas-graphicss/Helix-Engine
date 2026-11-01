import 'server-only';
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { restrictSourceMapTo } from './java-source-map';
import { parseJavacOutput } from './javac-diagnostics';
import { run } from './process';
import { toolchain, type JavaToolchain } from './toolchains';
import { cacheDir, hashOf, sdkSourceDir, withWorkspace } from './workspace';
export interface JavaBuildOutput {
    readonly ok: boolean;
    readonly js: string | null;
    readonly sourceMap: string | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
export interface JavaSibling {
    readonly file: string;
    readonly source: string;
}
const JAVAC_TIMEOUT = 120000;
const TEAVM_TIMEOUT = 300000;
const BOOT_CLASS = 'HelixBoot';
const DRIVER_CLASS = 'HelixBuild';
const HOOK_NAMES = ['onLoad', 'onStart', 'onUpdate', 'onFixedUpdate', 'onLateUpdate', 'onRender', 'onEnable', 'onDisable', 'onStop', 'onDestroy', 'onBeforeHotReload', 'onHotReload', 'onCollisionBegin', 'onCollisionStay', 'onCollisionEnd', 'onTriggerEnter', 'onTriggerStay', 'onTriggerExit'];
const PACKAGE = /^\s*package\s+([\w.]+)\s*;/m;
const SCRIPT_CLASS = /\bclass\s+(\w+)\s+extends\s+(?:helix\.)?Script\b/;
const HOOK_DECLARATION = /\b(?:void|Object)\s+(on[A-Z]\w*)\s*\(/g;
export async function buildJava(file: string, source: string, siblings: readonly JavaSibling[] = []): Promise<JavaBuildOutput> {
    const java = await toolchain('java');
    const [sdk, driver] = await Promise.all([sdkClasses(java), driverClasses(java)]);
    const jso = java.teavmJars.filter((jar) => /teavm-(jso|interop)-[\d.]+\.jar$/.test(jar));
    const compileFile = javaFileFor(file, source);
    return withWorkspace('java', async (dir) => {
        const src = path.join(dir, 'src');
        const classes = path.join(dir, 'classes');
        const out = path.join(dir, 'out');
        await Promise.all([mkdir(src), mkdir(classes), mkdir(out)]);
        await writeFile(path.join(src, compileFile), source, 'utf8');
        for (const sibling of siblings) {
            const siblingFile = javaFileFor(sibling.file, sibling.source);
            if (sibling.file !== file && siblingFile !== compileFile)
                await writeFile(path.join(src, siblingFile), sibling.source, 'utf8');
        }
        const boot = bootSource(source);
        await writeFile(path.join(src, `${BOOT_CLASS}.java`), boot.code, 'utf8');
        const sources = (await readdir(src)).filter((name) => name.endsWith('.java')).map((name) => path.join('src', name));
        const compiled = await run(java.javac, ['-encoding', 'UTF-8', '-g', '-proc:none', '-Xlint:none', '-Xdiags:verbose', '-Xmaxerrs', '50', '-d', 'classes', '-cp', [sdk, ...jso].join(path.delimiter), ...sources], {
            cwd: dir,
            timeoutMs: JAVAC_TIMEOUT,
        });
        const diagnostics = parseJavacOutput(compiled.stderr, compileFile);
        if (compiled.timedOut)
            diagnostics.push(toolchainError('O javac demorou demais e foi interrompido; tente de novo.'));
        if (compiled.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
                diagnostics.push(toolchainError(`O javac terminou com código ${compiled.code ?? compiled.signal}:\n${compiled.stderr.trim() || 'sem saída'}`));
            return { ok: false, js: null, sourceMap: null, diagnostics, toolchain: java.version };
        }
        const generated = await run(java.java, ['-Xss4m', '-cp', [...java.teavmJars, driver].join(path.delimiter), DRIVER_CLASS, [classes, sdk].join(path.delimiter), out, BOOT_CLASS], {
            cwd: dir,
            timeoutMs: TEAVM_TIMEOUT,
        });
        diagnostics.push(...parseTeaVmProblems(generated.stdout, compileFile));
        if (generated.timedOut)
            diagnostics.push(toolchainError('O TeaVM demorou demais e foi interrompido; tente de novo.'));
        if (generated.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
                diagnostics.push(toolchainError(`O TeaVM terminou com código ${generated.code ?? generated.signal}:\n${generated.stderr.trim() || generated.stdout.trim() || 'sem saída'}`));
            return { ok: false, js: null, sourceMap: null, diagnostics, toolchain: java.version };
        }
        const [js, map] = await Promise.all([readFile(path.join(out, 'script.js'), 'utf8'), readFile(path.join(out, 'script.js.map'), 'utf8').catch(() => null)]);
        return {
            ok: true,
            js: wrapModule(js, boot.hasScript),
            sourceMap: map ? restrictSourceMapTo(map, compileFile) : null,
            diagnostics,
            toolchain: java.version,
        };
    });
}
const PUBLIC_TYPE = /\bpublic\s+(?:(?:final|abstract|strictfp|sealed|non-sealed)\s+)*(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/;
export function javaFileFor(file: string, source: string): string {
    const declared = PUBLIC_TYPE.exec(stripComments(source))?.[1];
    if (declared)
        return `${declared}.java`;
    const stem = file
        .replace(/\.[^.]+$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_$]/g, '_');
    return `${/^[0-9]/.test(stem) ? `_${stem}` : stem || 'Script'}.java`;
}
function bootSource(source: string): {
    code: string;
    hasScript: boolean;
} {
    const pkg = PACKAGE.exec(source)?.[1] ?? null;
    const scriptClass = SCRIPT_CLASS.exec(stripComments(source))?.[1] ?? null;
    const hooks = new Set<string>();
    for (const match of stripComments(source).matchAll(HOOK_DECLARATION))
        if (HOOK_NAMES.includes(match[1]))
            hooks.add(match[1]);
    const qualified = scriptClass ? (pkg ? `${pkg}.${scriptClass}` : scriptClass) : null;
    const body = qualified
        ? `    @JSExport\n    public static JSObject create(JSObject inject) {\n        return helix.Runtime.boot(new ${qualified}(), inject, "${Array.from(hooks).join(',')}");\n    }\n`
        : `    @JSExport\n    public static JSObject create(JSObject inject) {\n        return null;\n    }\n`;
    return {
        code: `import org.teavm.jso.JSExport;\nimport org.teavm.jso.JSObject;\n\npublic final class ${BOOT_CLASS} {\n${body}}\n`,
        hasScript: qualified !== null,
    };
}
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
function wrapModule(js: string, hasScript: boolean): string {
    const body = js.replace(/^\/\/# sourceMappingURL=.*$/m, '');
    const tail = hasScript
        ? '\nconst __helixCreate = exports.create;\ndelete exports.create;\nmodule.exports.default = function helixCreate(inject) { return __helixCreate(inject); };\n'
        : '\ndelete exports.create;\n';
    return body + tail;
}
interface TeaVmProblem {
    readonly severity: 'error' | 'warning';
    readonly text: string;
    readonly file: string | null;
    readonly line: number;
    readonly method: string | null;
}
function parseTeaVmProblems(stdout: string, file: string): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    for (const raw of stdout.split('\n')) {
        const line = raw.trim();
        if (!line.startsWith('{'))
            continue;
        let problem: TeaVmProblem;
        try {
            problem = JSON.parse(line) as TeaVmProblem;
        }
        catch {
            continue;
        }
        const base = problem.file ? (problem.file.split('/').pop() ?? problem.file) : null;
        const inFile = base === file;
        const where = !inFile && problem.method ? ` (em ${problem.method})` : '';
        diagnostics.push({
            severity: problem.severity,
            message: `${humanizeTeaVm(problem.text)}${where}`,
            line: inFile && problem.line > 0 ? problem.line : 1,
            column: 1,
            code: 'teavm',
            source: 'Java (TeaVM)',
        });
    }
    return diagnostics;
}
function humanizeTeaVm(text: string): string {
    const method = /^Method (.+?) was not found$/.exec(text);
    if (method)
        return `O método ${method[1]} não existe na biblioteca Java do TeaVM (o subconjunto que roda no navegador).`;
    const klass = /^Class (.+?) was not found$/.exec(text);
    if (klass)
        return `A classe ${klass[1]} não existe na biblioteca Java do TeaVM (o subconjunto que roda no navegador).`;
    return text;
}
async function sdkClasses(java: JavaToolchain): Promise<string> {
    const dir = path.join(sdkSourceDir('java'), 'helix');
    const files = (await readdir(dir)).filter((name) => name.endsWith('.java')).sort();
    const sources = await Promise.all(files.map((name) => readFile(path.join(dir, name), 'utf8')));
    const key = hashOf('sdk-v1', java.version, ...files, ...sources);
    return compiledOnce(java, 'sdk', key, async (work) => {
        const classpath = java.teavmJars.filter((jar) => /teavm-(jso|interop)-[\d.]+\.jar$/.test(jar)).join(path.delimiter);
        const result = await run(java.javac, ['-encoding', 'UTF-8', '-g', '-proc:none', '-Xlint:none', '-d', work, '-cp', classpath, ...files.map((name) => path.join(dir, name))], { cwd: dir, timeoutMs: JAVAC_TIMEOUT });
        if (result.code !== 0)
            throw new Error(`o SDK Java da engine não compilou com ${java.version}:\n${result.stderr.trim()}`);
    });
}
async function driverClasses(java: JavaToolchain): Promise<string> {
    const file = path.join(process.cwd(), 'engine', 'scripting', 'build', 'java-driver', 'HelixBuild.java');
    const source = await readFile(file, 'utf8');
    const key = hashOf('driver-v1', java.version, source);
    return compiledOnce(java, 'driver', key, async (work) => {
        const result = await run(java.javac, ['-encoding', 'UTF-8', '-proc:none', '-Xlint:none', '-d', work, '-cp', java.teavmJars.join(path.delimiter), file], { cwd: path.dirname(file), timeoutMs: JAVAC_TIMEOUT });
        if (result.code !== 0)
            throw new Error(`o driver do TeaVM não compilou com ${java.version}:\n${result.stderr.trim()}`);
    });
}
async function compiledOnce(java: JavaToolchain, kind: string, key: string, compile: (work: string) => Promise<void>): Promise<string> {
    void java;
    const target = path.join(await cacheDir('java', `${kind}-${key}`), 'classes');
    try {
        await access(path.join(target, '.ready'));
        return target;
    }
    catch {
    }
    await withWorkspace('java', async (work) => {
        const staging = path.join(work, 'classes');
        await mkdir(staging);
        await compile(staging);
        await writeFile(path.join(staging, '.ready'), '');
        await rm(target, { recursive: true, force: true }).catch(() => undefined);
        await rename(staging, target).catch(async (cause: NodeJS.ErrnoException) => {
            if (cause.code !== 'EEXIST' && cause.code !== 'ENOTEMPTY')
                throw cause;
        });
    });
    return target;
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Java' };
}
