import { engineTarget, ensureLanguageEngine, FOREIGN_LANGUAGES, isForeignLanguage, loadedLanguageEngine, type ForeignCompileOutput, type ForeignSibling } from '../languages/language-engine';
import { compileToml } from '../languages/toml/toml-compiler';
import { MODULE_PARAMETERS } from '../runtime/sandbox';
import { scriptFileName, type ScriptRunContext } from '../script-document';
import { scriptLanguage, type ScriptLanguageId } from '../script-languages';
import { countDiagnostics, isDataKind, isExecutableKind, type CompileDiagnostic, type CompiledKind, type CompiledScript } from './compile-types';
import { decodeSourceMap } from './source-map';
import { stripSpecifierExtension, type ModuleLanguage } from './project-index';
import { loadTypeScriptProject, type TypeScriptWorkerProject } from './typescript-worker-client';
import { compileCss, compileHtml, compileJson, compileSvg, type WebCompileOutput } from './web-compiler';
export const COMPILABLE_LANGUAGES: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['javascript', 'typescript', 'html', 'css', 'svg', 'json', 'toml', ...FOREIGN_LANGUAGES]);
export function isCompilableLanguage(language: ScriptLanguageId): boolean {
    return COMPILABLE_LANGUAGES.has(language);
}
export function usesTypeScriptCompiler(language: ScriptLanguageId): boolean {
    return compiledKindOf(language) === 'module' && !isForeignLanguage(language);
}
export function compiledKindOf(language: ScriptLanguageId): CompiledKind | null {
    const target = engineTarget(language);
    if (target)
        return target === 'javascript' ? 'module' : target === 'shader' ? 'shader' : 'foreign';
    switch (language) {
        case 'javascript':
        case 'typescript':
            return 'module';
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        case 'svg':
            return 'svg';
        case 'json':
            return 'json';
        case 'toml':
            return 'toml';
        default:
            return null;
    }
}
export const DATA_LANGUAGES: readonly ScriptLanguageId[] = Array.from(COMPILABLE_LANGUAGES).filter((language) => {
    const kind = compiledKindOf(language);
    return kind !== null && isDataKind(kind);
});
export const EXECUTABLE_LANGUAGES: readonly ScriptLanguageId[] = Array.from(COMPILABLE_LANGUAGES).filter((language) => {
    const kind = compiledKindOf(language);
    return kind !== null && isExecutableKind(kind);
});
export interface ScriptSourceInput {
    readonly assetId: string;
    readonly name: string;
    readonly language: ScriptLanguageId;
    readonly source: string;
    readonly runContext: ScriptRunContext;
    readonly contentHash: string;
}
export function compileKeyOf(input: ScriptSourceInput): string {
    return `${input.contentHash}|${input.language}|${input.name}|${input.runContext}`;
}
export interface ResolvedScript {
    readonly assetId: string;
    readonly name: string;
    readonly language: ScriptLanguageId;
}
interface CacheEntry {
    result: CompiledScript;
    moduleGeneration: number;
    dependencyKeys: ReadonlyMap<string, string> | null;
}
const TEXTUAL_INCLUDE_LANGUAGES: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['c', 'cpp', 'java', 'kotlin']);
export interface CompileOptions {
    readonly roots?: ReadonlySet<string>;
}
export interface CompileBatchResult {
    readonly compiled: readonly CompiledScript[];
    readonly reused: number;
    readonly durationMs: number;
}
type Finish = (kind: CompiledKind, code: string | null, sourceMap: string | null, diagnostics: readonly CompileDiagnostic[], dependencies: readonly string[], artifact?: Uint8Array | null) => CompiledScript;
export class ScriptCompiler {
    private readonly cache = new Map<string, CacheEntry>();
    private readonly inputs = new Map<string, ScriptSourceInput>();
    private readonly engineFailures = new Map<ScriptLanguageId, string>();
    private project: TypeScriptWorkerProject | null = null;
    private projectLoading: Promise<TypeScriptWorkerProject> | null = null;
    private moduleGeneration = 1;
    private sealed = false;
    get typescriptReady(): boolean {
        return this.project !== null;
    }
    seal(scripts: readonly CompiledScript[]): void {
        this.sealed = true;
        this.cache.clear();
        for (const script of scripts)
            this.cache.set(script.assetId, { result: script, moduleGeneration: this.moduleGeneration, dependencyKeys: null });
    }
    get isSealed(): boolean {
        return this.sealed;
    }
    get typescriptVersion(): string | null {
        return this.project?.version ?? null;
    }
    get(assetId: string): CompiledScript | null {
        return this.cache.get(assetId)?.result ?? null;
    }
    isFresh(input: ScriptSourceInput): boolean {
        const entry = this.cache.get(input.assetId);
        if (entry === undefined || entry.result.key !== compileKeyOf(input))
            return false;
        if (entry.result.kind === 'module' && !isForeignLanguage(input.language) && entry.moduleGeneration !== this.moduleGeneration)
            return false;
        if (entry.dependencyKeys) {
            for (const [assetId, key] of entry.dependencyKeys) {
                const dependency = this.inputs.get(assetId);
                if (!dependency || compileKeyOf(dependency) !== key)
                    return false;
            }
        }
        return true;
    }
    private dependencyKeysOf(result: CompiledScript): ReadonlyMap<string, string> | null {
        if (!TEXTUAL_INCLUDE_LANGUAGES.has(result.language))
            return null;
        const keys = new Map<string, string>();
        for (const specifier of result.dependencies) {
            const resolved = this.resolveScript(specifier);
            const input = resolved ? this.inputs.get(resolved.assetId) : null;
            if (input && input.assetId !== result.assetId)
                keys.set(input.assetId, compileKeyOf(input));
        }
        return keys;
    }
    invalidate(assetId: string): void {
        this.cache.delete(assetId);
    }
    resolveScript(specifier: string): ResolvedScript | null {
        const viaProject = this.project?.resolveSpecifier(specifier);
        if (viaProject) {
            const input = this.inputs.get(viaProject.assetId);
            if (input)
                return describe(input);
        }
        const trimmed = specifier.trim();
        const cleaned = stripSpecifierExtension(trimmed.replace(/^\.?\//, '').replace(/^scripts\//i, ''));
        if (!cleaned)
            return null;
        let relaxed: ScriptSourceInput | null = null;
        const lower = cleaned.toLowerCase();
        for (const input of this.inputs.values()) {
            if (input.name === cleaned)
                return describe(input);
            if (!relaxed && input.name.toLowerCase() === lower)
                relaxed = input;
        }
        if (relaxed)
            return describe(relaxed);
        const byId = this.inputs.get(trimmed);
        return byId ? describe(byId) : null;
    }
    get scriptNames(): string[] {
        return Array.from(this.inputs.values(), (input) => input.name);
    }
    async compile(inputs: readonly ScriptSourceInput[], options: CompileOptions = {}): Promise<CompileBatchResult> {
        const started = performance.now();
        if (!this.sealed && inputs.some((input) => usesTypeScriptCompiler(input.language)))
            await this.ensureProject();
        this.syncScripts(inputs);
        const compiled: CompiledScript[] = [];
        let reused = 0;
        const compileInput = async (input: ScriptSourceInput): Promise<CompiledScript> => {
            if (this.isFresh(input)) {
                reused++;
                const result = this.cache.get(input.assetId)!.result;
                compiled.push(result);
                return result;
            }
            if (this.sealed) {
                const result = this.missingFromSeal(input);
                compiled.push(result);
                return result;
            }
            const foreign = isForeignLanguage(input.language);
            if (foreign)
                await this.loadEngine(input.language);
            const result = await this.instrumentModule(await this.compileOne(input));
            if (!foreign || loadedLanguageEngine(input.language)) {
                this.cache.set(input.assetId, { result, moduleGeneration: this.moduleGeneration, dependencyKeys: this.dependencyKeysOf(result) });
            }
            compiled.push(result);
            return result;
        };
        if (options.roots) {
            const seen = new Set<string>();
            const queue = Array.from(options.roots);
            while (queue.length > 0) {
                const assetId = queue.shift()!;
                if (seen.has(assetId))
                    continue;
                seen.add(assetId);
                const input = this.inputs.get(assetId);
                if (!input)
                    continue;
                const result = await compileInput(input);
                for (const specifier of result.dependencies) {
                    const resolved = this.resolveScript(specifier);
                    if (resolved && !seen.has(resolved.assetId))
                        queue.push(resolved.assetId);
                }
            }
        }
        else {
            for (const input of inputs)
                await compileInput(input);
        }
        const stale = new Set(this.cache.keys());
        for (const input of inputs)
            stale.delete(input.assetId);
        for (const assetId of stale)
            this.cache.delete(assetId);
        return { compiled, reused, durationMs: performance.now() - started };
    }
    warmUp(): void {
        if (this.sealed)
            return;
        void this.ensureProject().catch(() => undefined);
    }
    ensureProject(): Promise<TypeScriptWorkerProject> {
        if (this.sealed)
            return Promise.reject(new Error('O compilador TypeScript não acompanha o jogo compilado; os scripts já vêm prontos.'));
        if (this.project)
            return Promise.resolve(this.project);
        if (!this.projectLoading) {
            this.projectLoading = loadTypeScriptProject()
                .then(async (project) => {
                await project.clear();
                this.project = project;
                this.syncScripts(Array.from(this.inputs.values()));
                return project;
            })
                .finally(() => {
                this.projectLoading = null;
            });
        }
        return this.projectLoading;
    }
    syncScripts(inputs: readonly ScriptSourceInput[]): void {
        this.inputs.clear();
        for (const input of inputs)
            this.inputs.set(input.assetId, input);
        const project = this.project;
        if (!project)
            return;
        const modules = inputs.filter((input) => usesTypeScriptCompiler(input.language));
        const foreign = inputs.filter((input) => isForeignLanguage(input.language) && compiledKindOf(input.language) !== 'shader');
        const data = inputs.filter((input) => DATA_LANGUAGES.includes(input.language));
        let changed = project.retainOnly(new Set([...modules, ...foreign, ...data].map((input) => input.assetId)));
        for (const input of modules) {
            changed = project.setScript({ assetId: input.assetId, name: input.name, language: input.language as ModuleLanguage, source: input.source, runContext: input.runContext }) || changed;
        }
        for (const input of [...foreign, ...data]) {
            changed = project.setScript({ assetId: input.assetId, name: input.name, language: 'foreign', source: '', runContext: input.runContext }) || changed;
        }
        if (changed)
            this.moduleGeneration++;
    }
    updateLiveSource(input: ScriptSourceInput): void {
        this.inputs.set(input.assetId, input);
        if (this.project && compiledKindOf(input.language) === 'module' && !isForeignLanguage(input.language)) {
            if (this.project.setScript({ assetId: input.assetId, name: input.name, language: input.language as ModuleLanguage, source: input.source, runContext: input.runContext }))
                this.moduleGeneration++;
        }
    }
}
