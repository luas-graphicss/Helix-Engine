import 'server-only';
import { access, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { NativeBuildLanguage } from '../languages/native/build-protocol';
import { run } from './process';
export interface RustToolchain {
    readonly language: 'rust';
    readonly version: string;
    readonly rustc: string;
    readonly env: Readonly<Record<string, string>>;
}
export interface GoToolchain {
    readonly language: 'go';
    readonly version: string;
    readonly go: string;
    readonly env: Readonly<Record<string, string>>;
}
export interface JavaToolchain {
    readonly language: 'java';
    readonly version: string;
    readonly java: string;
    readonly javac: string;
    readonly teavmJars: readonly string[];
    readonly teavmVersion: string;
}
export interface KotlinToolchain {
    readonly language: 'kotlin';
    readonly version: string;
    readonly java: string;
    readonly javac: string;
    readonly home: string;
    readonly compilerClasspath: readonly string[];
    readonly stdlib: string;
}
export interface SwiftToolchain {
    readonly language: 'swift';
    readonly version: string;
    readonly swiftc: string;
    readonly target: string;
    readonly sysroot: string;
    readonly resourceDir: string;
    readonly clangResourceDir: string;
}
export interface ZigToolchain {
    readonly language: 'zig';
    readonly version: string;
    readonly zig: string;
    readonly cacheDir: string;
    readonly env: Readonly<Record<string, string>>;
}
export interface DartToolchain {
    readonly language: 'dart';
    readonly version: string;
    readonly dart: string;
    readonly env: Readonly<Record<string, string>>;
}
export interface HaxeToolchain {
    readonly language: 'haxe';
    readonly version: string;
    readonly haxe: string;
    readonly std: string;
    readonly env: Readonly<Record<string, string>>;
}
export type Toolchain = RustToolchain | GoToolchain | JavaToolchain | KotlinToolchain | SwiftToolchain | ZigToolchain | DartToolchain | HaxeToolchain;
export class ToolchainUnavailable extends Error {
    constructor(readonly language: NativeBuildLanguage, readonly detail: string) {
        super(detail);
        this.name = 'ToolchainUnavailable';
    }
}
export const RUST_TARGET = 'wasm32-wasip1';
const PROBE_TIMEOUT = 30000;
export function toolchainsDir(): string {
    return process.env.HELIX_TOOLCHAINS_DIR ?? path.join(homedir(), '.helix', 'toolchains');
}
export const INSTALL_HINT = 'Instale com scripts/install-toolchains.sh no servidor que roda a engine (ou aponte HELIX_TOOLCHAINS_DIR para uma instalação existente).';
const found = new Map<NativeBuildLanguage, Toolchain>();
const probing = new Map<NativeBuildLanguage, Promise<Toolchain>>();
export function toolchain(language: 'rust'): Promise<RustToolchain>;
export function toolchain(language: 'go'): Promise<GoToolchain>;
export function toolchain(language: 'java'): Promise<JavaToolchain>;
export function toolchain(language: 'kotlin'): Promise<KotlinToolchain>;
export function toolchain(language: 'swift'): Promise<SwiftToolchain>;
export function toolchain(language: 'zig'): Promise<ZigToolchain>;
export function toolchain(language: 'dart'): Promise<DartToolchain>;
export function toolchain(language: 'haxe'): Promise<HaxeToolchain>;
export function toolchain(language: NativeBuildLanguage): Promise<Toolchain>;
export function toolchain(language: NativeBuildLanguage): Promise<Toolchain> {
    const ready = found.get(language);
    if (ready)
        return Promise.resolve(ready);
    let pending = probing.get(language);
    if (!pending) {
        pending = probe(language)
            .then((result) => {
            found.set(language, result);
            return result;
        })
            .finally(() => probing.delete(language));
        probing.set(language, pending);
    }
    return pending;
}
function probe(language: NativeBuildLanguage): Promise<Toolchain> {
    switch (language) {
        case 'rust':
            return probeRust();
        case 'go':
            return probeGo();
        case 'java':
            return probeJava();
        case 'kotlin':
            return probeKotlin();
        case 'swift':
            return probeSwift();
        case 'zig':
            return probeZig();
        case 'dart':
            return probeDart();
        case 'haxe':
            return probeHaxe();
    }
}
async function exists(file: string): Promise<boolean> {
    try {
        await access(file);
        return true;
    }
    catch {
        return false;
    }
}
async function locate(candidates: readonly string[], onPath: string): Promise<string | null> {
    for (const candidate of candidates)
        if (await exists(candidate))
            return candidate;
    const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
    for (const dir of dirs) {
        const file = path.join(dir, onPath);
        if (await exists(file))
            return file;
    }
    return null;
}
async function probeRust(): Promise<RustToolchain> {
    const root = toolchainsDir();
    const rustc = await locate([path.join(root, 'cargo', 'bin', 'rustc'), path.join(homedir(), '.cargo', 'bin', 'rustc')], 'rustc');
    if (!rustc)
        throw new ToolchainUnavailable('rust', `rustc não foi encontrado no servidor. ${INSTALL_HINT}`);
    const env: Record<string, string> = {};
    if (await exists(path.join(root, 'rustup')))
        env.RUSTUP_HOME = path.join(root, 'rustup');
    if (await exists(path.join(root, 'cargo')))
        env.CARGO_HOME = path.join(root, 'cargo');
    const version = await run(rustc, ['--version'], { cwd: root, env, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable('rust', `rustc existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const libdir = await run(rustc, ['--print', 'target-libdir', '--target', RUST_TARGET], { cwd: root, env, timeoutMs: PROBE_TIMEOUT });
    if (libdir.code !== 0 || !(await exists(libdir.stdout.trim()))) {
        throw new ToolchainUnavailable('rust', `rustc está instalado sem o alvo ${RUST_TARGET}. Rode "rustup target add ${RUST_TARGET}" no servidor.`);
    }
    return { language: 'rust', version: version.stdout.trim().split('\n')[0], rustc, env };
}
async function probeGo(): Promise<GoToolchain> {
    const root = toolchainsDir();
    const go = await locate([path.join(root, 'go', 'bin', 'go'), '/usr/local/go/bin/go'], 'go');
    if (!go)
        throw new ToolchainUnavailable('go', `go não foi encontrado no servidor. ${INSTALL_HINT}`);
    const env: Record<string, string> = {
        GOPATH: path.join(root, 'gopath'),
        GOCACHE: path.join(root, 'gocache'),
        GOMODCACHE: path.join(root, 'gopath', 'pkg', 'mod'),
        GOTOOLCHAIN: 'local',
        GOPROXY: 'off',
        GOSUMDB: 'off',
        GOFLAGS: '-mod=mod',
        CGO_ENABLED: '0',
        GOOS: 'wasip1',
        GOARCH: 'wasm',
    };
    const version = await run(go, ['version'], { cwd: root, env, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable('go', `go existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const match = /go version (\S+)/.exec(version.stdout);
    const tag = match ? match[1] : version.stdout.trim();
    const minor = Number(/^go1\.(\d+)/.exec(tag)?.[1] ?? 0);
    if (minor < 24)
        throw new ToolchainUnavailable('go', `o Go ${tag} é antigo demais: a engine precisa do Go 1.24 ou mais novo (go:wasmexport e -buildmode=c-shared para wasip1).`);
    return { language: 'go', version: tag, go, env };
}
interface Jdk {
    readonly java: string;
    readonly javac: string;
    readonly version: string;
}
async function locateJdk(language: NativeBuildLanguage): Promise<Jdk> {
    const root = toolchainsDir();
    const homes = [path.join(root, 'jdk'), ...(process.env.JAVA_HOME ? [process.env.JAVA_HOME] : [])];
    const java = await locate(homes.map((home) => path.join(home, 'bin', 'java')), 'java');
    const javac = await locate(homes.map((home) => path.join(home, 'bin', 'javac')), 'javac');
    if (!java || !javac)
        throw new ToolchainUnavailable(language, `um JDK (java e javac) não foi encontrado no servidor. ${INSTALL_HINT}`);
    const version = await run(java, ['-version'], { cwd: root, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable(language, `java existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const javaVersion = /version "([^"]+)"/.exec(version.stderr)?.[1] ?? version.stderr.trim().split('\n')[0];
    const major = Number(javaVersion.split('.')[0]);
    if (major < 17)
        throw new ToolchainUnavailable(language, `o Java ${javaVersion} é antigo demais: a engine precisa do JDK 17 ou mais novo.`);
    return { java, javac, version: javaVersion };
}
async function probeJava(): Promise<JavaToolchain> {
    const root = toolchainsDir();
    const { java, javac, version: javaVersion } = await locateJdk('java');
    const teavmDir = process.env.HELIX_TEAVM_LIB ?? path.join(root, 'teavm', 'lib');
    let jars: string[];
    try {
        jars = (await readdir(teavmDir)).filter((name) => name.endsWith('.jar')).map((name) => path.join(teavmDir, name));
    }
    catch {
        jars = [];
    }
    const core = jars.find((jar) => /teavm-core-[\d.]+\.jar$/.test(jar));
    if (!core)
        throw new ToolchainUnavailable('java', `o TeaVM (compilador Java → JavaScript) não está em ${teavmDir}. ${INSTALL_HINT}`);
    const teavmVersion = /teavm-core-([\d.]+)\.jar$/.exec(core)?.[1] ?? '?';
    return { language: 'java', version: `Java ${javaVersion} + TeaVM ${teavmVersion}`, java, javac, teavmJars: jars, teavmVersion };
}
const KOTLIN_EXTRA_JARS = ['kotlin-stdlib.jar', 'kotlin-reflect.jar', 'kotlin-script-runtime.jar', 'annotations-13.0.jar', 'kotlinx-coroutines-core-jvm.jar', 'trove4j.jar'];
async function probeKotlin(): Promise<KotlinToolchain> {
    const root = toolchainsDir();
    const { java, javac, version: javaVersion } = await locateJdk('kotlin');
    const candidates = [path.join(root, 'kotlin'), ...(process.env.KOTLIN_HOME ? [process.env.KOTLIN_HOME] : [])];
    let home: string | null = null;
    for (const candidate of candidates) {
        if (await exists(path.join(candidate, 'lib', 'kotlin-compiler.jar'))) {
            home = candidate;
            break;
        }
    }
    if (!home) {
        const onPath = await locate([], 'kotlinc-js');
        if (onPath && (await exists(path.join(path.dirname(path.dirname(onPath)), 'lib', 'kotlin-compiler.jar'))))
            home = path.dirname(path.dirname(onPath));
    }
    if (!home)
        throw new ToolchainUnavailable('kotlin', `o compilador Kotlin (kotlinc-js) não foi encontrado no servidor. ${INSTALL_HINT}`);
    const compiler = path.join(home, 'lib', 'kotlin-compiler.jar');
    const stdlib = path.join(home, 'lib', 'kotlin-stdlib-js.klib');
    if (!(await exists(stdlib)))
        throw new ToolchainUnavailable('kotlin', `a distribuição do Kotlin em ${home} não tem a biblioteca padrão para JavaScript (lib/kotlin-stdlib-js.klib).`);
    const compilerClasspath = [compiler];
    for (const jar of KOTLIN_EXTRA_JARS) {
        const file = path.join(home, 'lib', jar);
        if (await exists(file))
            compilerClasspath.push(file);
    }
    let kotlinVersion = (await readFile(path.join(home, 'build.txt'), 'utf8').catch(() => '')).trim().split(/[\s-]/)[0];
    if (!kotlinVersion) {
        const probe = await run(java, ['-cp', compilerClasspath.join(path.delimiter), 'org.jetbrains.kotlin.cli.js.K2JSCompiler', '-version'], { cwd: root, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
        kotlinVersion = /kotlinc-js (\S+)/.exec(`${probe?.stderr ?? ''}\n${probe?.stdout ?? ''}`)?.[1] ?? '';
        if (!kotlinVersion)
            throw new ToolchainUnavailable('kotlin', `o compilador Kotlin em ${home} não responde: ${probe?.stderr.trim() || 'sem saída'}.`);
    }
    const [major, minor] = kotlinVersion.split('.').map(Number);
    if (major < 2 || (major === 2 && minor < 1))
        throw new ToolchainUnavailable('kotlin', `o Kotlin ${kotlinVersion} é antigo demais: a engine precisa do Kotlin 2.1 ou mais novo (compilador K2 para JavaScript).`);
    return { language: 'kotlin', version: `Kotlin ${kotlinVersion} (JDK ${javaVersion})`, java, javac, home, compilerClasspath, stdlib };
}
export const SWIFT_TARGET = 'wasm32-unknown-wasip1';
