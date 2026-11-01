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
async function probeSwift(): Promise<SwiftToolchain> {
    const root = toolchainsDir();
    const swiftc = await locate([path.join(root, 'swift', 'toolchain', 'usr', 'bin', 'swiftc'), ...(process.env.SWIFT_HOME ? [path.join(process.env.SWIFT_HOME, 'usr', 'bin', 'swiftc')] : [])], 'swiftc');
    if (!swiftc)
        throw new ToolchainUnavailable('swift', `swiftc não foi encontrado no servidor. ${INSTALL_HINT}`);
    const version = await run(swiftc, ['--version'], { cwd: root, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable('swift', `swiftc existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const swiftVersion = /Swift version (\S+)/.exec(`${version.stdout}\n${version.stderr}`)?.[1] ?? version.stdout.trim().split('\n')[0];
    const [major, minor] = swiftVersion.split('.').map(Number);
    if (major < 6 || (major === 6 && minor < 2))
        throw new ToolchainUnavailable('swift', `o Swift ${swiftVersion} é antigo demais: a engine precisa do Swift 6.2 ou mais novo (Swift SDK para WebAssembly do swift.org).`);
    const sdk = await locateSwiftSdk(root);
    if (!sdk) {
        throw new ToolchainUnavailable('swift', `o Swift SDK para WebAssembly (${SWIFT_TARGET}) não foi encontrado: instale-o com scripts/install-toolchains.sh swift ou "swift sdk install" e, se preciso, aponte HELIX_SWIFT_SDK para a pasta ${SWIFT_TARGET} do artifactbundle.`);
    }
    const sysroot = path.join(sdk, 'WASI.sdk');
    const resourceDir = path.join(sdk, 'swift.xctoolchain', 'usr', 'lib', 'swift_static');
    const clangResourceDir = path.join(sdk, 'swift.xctoolchain', 'usr', 'lib', 'clang');
    for (const required of [sysroot, resourceDir, clangResourceDir]) {
        if (!(await exists(required)))
            throw new ToolchainUnavailable('swift', `o Swift SDK em ${sdk} está incompleto: falta ${path.relative(sdk, required)}.`);
    }
    return { language: 'swift', version: `Swift ${swiftVersion}`, swiftc, target: SWIFT_TARGET, sysroot, resourceDir, clangResourceDir };
}
export const ZIG_TARGET = 'wasm32-wasi';
const ZIG_MIN_MINOR = 17;
async function probeZig(): Promise<ZigToolchain> {
    const root = toolchainsDir();
    const zig = await locate([path.join(root, 'zig', 'zig'), ...(process.env.ZIG_HOME ? [path.join(process.env.ZIG_HOME, 'zig')] : [])], 'zig');
    if (!zig)
        throw new ToolchainUnavailable('zig', `zig não foi encontrado no servidor. ${INSTALL_HINT}`);
    const cacheDir = path.join(root, 'zig-cache');
    const env: Record<string, string> = { ZIG_GLOBAL_CACHE_DIR: cacheDir, ZIG_LOCAL_CACHE_DIR: cacheDir };
    const version = await run(zig, ['version'], { cwd: root, env, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable('zig', `zig existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const tag = version.stdout.trim().split('\n')[0];
    const [major, minor] = tag.split('.').map(Number);
    if (major === 0 && minor < ZIG_MIN_MINOR)
        throw new ToolchainUnavailable('zig', `o Zig ${tag} é antigo demais: a engine precisa do Zig 0.${ZIG_MIN_MINOR} ou mais novo.`);
    return { language: 'zig', version: `Zig ${tag}`, zig, cacheDir, env };
}
const DART_MIN = { major: 3, minor: 3 };
async function probeDart(): Promise<DartToolchain> {
    const root = toolchainsDir();
    const homes = [path.join(root, 'dart-sdk'), ...(process.env.DART_SDK ? [process.env.DART_SDK] : []), ...(process.env.DART_HOME ? [process.env.DART_HOME] : [])];
    const dart = await locate(homes.map((home) => path.join(home, 'bin', 'dart')), 'dart');
    if (!dart)
        throw new ToolchainUnavailable('dart', `o Dart SDK (dart) não foi encontrado no servidor. ${INSTALL_HINT}`);
    const env: Record<string, string> = { PUB_CACHE: path.join(root, 'pub-cache'), DART_SUPPRESS_ANALYTICS: 'true' };
    const version = await run(dart, ['--version'], { cwd: root, env, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable('dart', `dart existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const text = `${version.stdout}\n${version.stderr}`;
    const tag = /Dart SDK version: (\S+)/.exec(text)?.[1] ?? text.trim().split('\n')[0];
    const [major, minor] = tag.split('.').map(Number);
    if (major < DART_MIN.major || (major === DART_MIN.major && minor < DART_MIN.minor)) {
        throw new ToolchainUnavailable('dart', `o Dart ${tag} é antigo demais: a engine precisa do Dart ${DART_MIN.major}.${DART_MIN.minor} ou mais novo (dart:js_interop estável).`);
    }
    return { language: 'dart', version: `Dart ${tag}`, dart, env };
}
const HAXE_MIN = { major: 4, minor: 3 };
async function probeHaxe(): Promise<HaxeToolchain> {
    const root = toolchainsDir();
    const homes = [path.join(root, 'haxe'), ...(process.env.HAXE_HOME ? [process.env.HAXE_HOME] : [])];
    const haxe = await locate(homes.map((home) => path.join(home, 'haxe')), 'haxe');
    if (!haxe)
        throw new ToolchainUnavailable('haxe', `o compilador Haxe (haxe) não foi encontrado no servidor. ${INSTALL_HINT}`);
    const std = process.env.HAXE_STD_PATH ?? path.join(path.dirname(haxe), 'std');
    if (!(await exists(path.join(std, 'Std.hx'))))
        throw new ToolchainUnavailable('haxe', `a biblioteca padrão do Haxe não está em ${std} (aponte HAXE_STD_PATH para a pasta std/ da distribuição).`);
    const env: Record<string, string> = { HAXE_STD_PATH: std };
    const version = await run(haxe, ['--version'], { cwd: root, env, timeoutMs: PROBE_TIMEOUT }).catch(() => null);
    if (!version || version.code !== 0)
        throw new ToolchainUnavailable('haxe', `haxe existe mas não responde: ${version?.stderr.trim() || 'sem saída'}.`);
    const tag = `${version.stdout}\n${version.stderr}`.trim().split('\n')[0].trim();
    const [major, minor] = tag.split(/[.+-]/).map(Number);
    if (major < HAXE_MIN.major || (major === HAXE_MIN.major && minor < HAXE_MIN.minor)) {
        throw new ToolchainUnavailable('haxe', `o Haxe ${tag} é antigo demais: a engine precisa do Haxe ${HAXE_MIN.major}.${HAXE_MIN.minor} ou mais novo.`);
    }
    return { language: 'haxe', version: `Haxe ${tag}`, haxe, std, env };
}
async function locateSwiftSdk(root: string): Promise<string | null> {
    const isSdk = async (dir: string) => exists(path.join(dir, 'swift-sdk.json'));
    if (process.env.HELIX_SWIFT_SDK)
        return (await isSdk(process.env.HELIX_SWIFT_SDK)) ? process.env.HELIX_SWIFT_SDK : null;
    const bundleRoots = [path.join(root, 'swift', 'sdk'), path.join(homedir(), '.swiftpm', 'swift-sdks')];
    for (const bundles of bundleRoots) {
        const entries = await readdir(bundles).catch(() => [] as string[]);
        const direct = path.join(bundles, SWIFT_TARGET);
        if (entries.includes(SWIFT_TARGET) && (await isSdk(direct)))
            return direct;
        for (const entry of entries.sort().reverse()) {
            const bundle = path.join(bundles, entry);
            const candidate = path.join(bundle, SWIFT_TARGET);
            if (await isSdk(candidate))
                return candidate;
            const variants = await readdir(bundle).catch(() => [] as string[]);
            for (const variant of variants.sort().reverse()) {
                const nested = path.join(bundle, variant, SWIFT_TARGET);
                if (await isSdk(nested))
                    return nested;
            }
        }
    }
    return null;
}
