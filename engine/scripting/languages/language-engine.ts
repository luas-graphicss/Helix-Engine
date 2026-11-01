import type { LogLevel } from '@/engine/editor/session/editor-log';
import type { CompileDiagnostic, CompiledScript } from '../compiler/compile-types';
import type { ScriptOwner } from '../runtime/runtime-context';
import type { InjectedFields } from '../runtime/script-instance';
import type { ScriptLanguageId } from '../script-languages';
export interface ForeignCompileInput {
    readonly assetId: string;
    readonly name: string;
    readonly file: string;
    readonly source: string;
    readonly siblings?: readonly ForeignSibling[];
}
export interface ForeignSibling {
    readonly assetId: string;
    readonly name: string;
    readonly file: string;
    readonly source: string;
}
export interface ForeignCompileOutput {
    readonly artifact: Uint8Array | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
    readonly code?: string | null;
    readonly sourceMap?: string | null;
}
export interface ForeignLocation {
    readonly file: string;
    readonly line: number;
    readonly column?: number;
    readonly assetId?: string | null;
    readonly functionName?: string | null;
}
export interface ForeignGameHost {
    readonly helix: Record<string, unknown>;
    console(level: LogLevel, message: string, location: ForeignLocation | null): void;
    resolveScript(specifier: string): CompiledScript | null;
    compiledById(assetId: string): CompiledScript | null;
    requireForeign(from: CompiledScript | null, target: CompiledScript): unknown;
    moduleNames(): string[];
    assetIdOfFile(file: string): string | null;
    enter(game: ForeignGame): void;
    exit(game: ForeignGame): void;
    currentOwner(): ScriptOwner | null;
    invoke<T>(owner: ScriptOwner | null, label: string, fn: () => T): T | undefined;
}
export interface ForeignGame {
    readonly language: ScriptLanguageId;
    loadModule(compiled: CompiledScript): unknown;
    instantiate(compiled: CompiledScript, inject: InjectedFields): Record<string, unknown>;
    unloadModule(assetId: string): void;
    callerLocation(): ForeignLocation | null;
    dispose(): void;
}
export interface ScriptLanguageEngine {
    readonly label: string;
    readonly languages: readonly ScriptLanguageId[];
    readonly loaded: boolean;
    readonly version: string | null;
    load(): Promise<void>;
    compile(input: ForeignCompileInput): ForeignCompileOutput | Promise<ForeignCompileOutput>;
    createGame(host: ForeignGameHost): Promise<ForeignGame>;
}
type EngineFactory = () => Promise<ScriptLanguageEngine>;
export type EngineTarget = 'runtime' | 'javascript' | 'shader';
interface EngineRegistration {
    readonly target: EngineTarget;
    readonly create: EngineFactory;
}
const clangEngine: EngineRegistration = { target: 'runtime', create: async () => (await import('./c/c-engine')).cEngine() };
const REGISTRY: ReadonlyMap<ScriptLanguageId, EngineRegistration> = new Map<ScriptLanguageId, EngineRegistration>([
    ['luau', { target: 'runtime', create: async () => (await import('./lua/luau-engine')).luauEngine() }],
    ['lua', { target: 'runtime', create: async () => (await import('./lua/lua54-engine')).lua54Engine() }],
    ['python', { target: 'runtime', create: async () => (await import('./python/python-engine')).pythonEngine() }],
    ['ruby', { target: 'runtime', create: async () => (await import('./ruby/ruby-engine')).rubyEngine() }],
    ['csharp', { target: 'javascript', create: async () => (await import('./csharp/csharp-engine')).csharpEngine() }],
    ['c', clangEngine],
    ['cpp', clangEngine],
    ['rust', { target: 'runtime', create: async () => (await import('./rust/rust-engine')).rustEngine() }],
    ['go', { target: 'runtime', create: async () => (await import('./go/go-engine')).goEngine() }],
    ['zig', { target: 'runtime', create: async () => (await import('./zig/zig-engine')).zigEngine() }],
    ['java', { target: 'javascript', create: async () => (await import('./java/java-engine')).javaEngine() }],
    ['kotlin', { target: 'javascript', create: async () => (await import('./kotlin/kotlin-engine')).kotlinEngine() }],
    ['swift', { target: 'runtime', create: async () => (await import('./swift/swift-engine')).swiftEngine() }],
    ['dart', { target: 'javascript', create: async () => (await import('./dart/dart-engine')).dartEngine() }],
    ['haxe', { target: 'javascript', create: async () => (await import('./haxe/haxe-engine')).haxeEngine() }],
    ['php', { target: 'runtime', create: async () => (await import('./php/php-engine')).phpEngine() }],
    ['gdscript', { target: 'javascript', create: async () => (await import('./gdscript/gdscript-engine')).gdscriptEngine() }],
    ['wat', { target: 'runtime', create: async () => (await import('./wat/wat-engine')).watEngine() }],
    ['glsl', { target: 'shader', create: async () => (await import('./shader/glsl-engine')).glslEngine() }],
    ['wgsl', { target: 'shader', create: async () => (await import('./shader/wgsl-engine')).wgslEngine() }],
]);
const instances = new Map<ScriptLanguageId, Promise<ScriptLanguageEngine>>();
export function isForeignLanguage(language: ScriptLanguageId): boolean {
    return REGISTRY.has(language);
}
export function engineTarget(language: ScriptLanguageId): EngineTarget | null {
    return REGISTRY.get(language)?.target ?? null;
}
export const FOREIGN_LANGUAGES: readonly ScriptLanguageId[] = Array.from(REGISTRY.keys());
const CHUNK_RETRY_DELAYS_MS: readonly number[] = [800, 2000, 4000, 7000];
export function isChunkLoadFailure(cause: unknown): boolean {
    const message = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    return /Failed to load chunk|ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch|NetworkError|Load failed/i.test(message);
}
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function createWithRetry(language: ScriptLanguageId, registration: EngineRegistration): Promise<ScriptLanguageEngine> {
    for (let attempt = 0;; attempt++) {
        try {
            return await registration.create();
        }
        catch (cause) {
            if (!isChunkLoadFailure(cause))
                throw cause;
            if (attempt >= CHUNK_RETRY_DELAYS_MS.length) {
                const detail = cause instanceof Error ? cause.message : String(cause);
                throw new Error(`o navegador não conseguiu baixar o código do compilador ${language} em ${attempt + 1} tentativas (${detail}). O servidor pode estar recompilando: espere alguns segundos e compile de novo; se persistir, recarregue a página.`);
            }
            await sleep(CHUNK_RETRY_DELAYS_MS[attempt]);
        }
    }
}
export function languageEngine(language: ScriptLanguageId): Promise<ScriptLanguageEngine> {
    const registration = REGISTRY.get(language);
    if (!registration)
        throw new Error(`${language} não roda num runtime estrangeiro.`);
    let instance = instances.get(language);
    if (!instance) {
        instance = createWithRetry(language, registration).catch((cause: unknown) => {
            instances.delete(language);
            throw cause;
        });
        instances.set(language, instance);
    }
    return instance;
}
export function warmLanguageEngines(languages: Iterable<ScriptLanguageId>): void {
    for (const language of new Set(languages)) {
        if (!REGISTRY.has(language))
            continue;
        void ensureLanguageEngine(language).catch(() => undefined);
    }
}
export function loadedLanguageEngine(language: ScriptLanguageId): ScriptLanguageEngine | null {
    return loadedEngines.get(language) ?? null;
}
const loadedEngines = new Map<ScriptLanguageId, ScriptLanguageEngine>();
export async function ensureLanguageEngine(language: ScriptLanguageId): Promise<ScriptLanguageEngine> {
    const engine = await languageEngine(language);
    if (!engine.loaded)
        await engine.load();
    loadedEngines.set(language, engine);
    return engine;
}
