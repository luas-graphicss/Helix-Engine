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
    siblingsOf(assetId: string, languages: readonly ScriptLanguageId[]): ForeignSibling[] {
        const siblings: ForeignSibling[] = [];
        for (const other of this.inputs.values()) {
            if (other.assetId === assetId || !languages.includes(other.language))
                continue;
            siblings.push({ assetId: other.assetId, name: other.name, file: scriptFileName(other.name, other.language), source: other.source });
        }
        return siblings;
    }
    private missingFromSeal(input: ScriptSourceInput): CompiledScript {
        const kind = compiledKindOf(input.language) ?? 'module';
        return {
            assetId: input.assetId,
            name: input.name,
            language: input.language,
            runContext: input.runContext,
            key: compileKeyOf(input),
            source: input.source,
            compiledAt: Date.now(),
            kind,
            code: null,
            artifact: null,
            sourceMap: null,
            dependencies: [],
            diagnostics: [{ severity: 'error', message: 'Este script não foi pré-compilado com o jogo; compile o jogo de novo na engine.', line: 1, column: 1, source: 'Compilador' }],
            errorCount: 1,
            warningCount: 0,
            durationMs: 0,
        };
    }
    private async loadEngine(language: ScriptLanguageId): Promise<void> {
        try {
            await ensureLanguageEngine(language);
            this.engineFailures.delete(language);
        }
        catch (cause) {
            this.engineFailures.set(language, cause instanceof Error ? cause.message : String(cause));
        }
    }
    private async instrumentModule(script: CompiledScript): Promise<CompiledScript> {
        if (this.sealed || script.kind !== 'module' || !script.code)
            return script;
        try {
            const project = await this.ensureProject();
            const output = await project.instrument(script.code, script.sourceMap, MODULE_PARAMETERS);
            if (!output)
                return script;
            return { ...script, debugCode: output.code, debugSourceMap: output.sourceMap, debugLines: output.lines };
        }
        catch {
            return script;
        }
    }
    private compileOne(input: ScriptSourceInput): CompiledScript | Promise<CompiledScript> {
        const started = performance.now();
        const kind = compiledKindOf(input.language);
        const base = {
            assetId: input.assetId,
            name: input.name,
            language: input.language,
            runContext: input.runContext,
            key: compileKeyOf(input),
            source: input.source,
            compiledAt: Date.now(),
        };
        const finish: Finish = (kind, code, sourceMap, diagnostics, dependencies, artifact = null) => {
            const { errors, warnings } = countDiagnostics(diagnostics);
            let decoded = null;
            if (sourceMap) {
                try {
                    decoded = decodeSourceMap(sourceMap);
                }
                catch {
                    decoded = null;
                }
            }
            return {
                ...base,
                kind,
                code: errors > 0 ? null : code,
                artifact: errors > 0 ? null : artifact,
                sourceMap: decoded,
                dependencies,
                diagnostics,
                errorCount: errors,
                warningCount: warnings,
                durationMs: performance.now() - started,
            };
        };
        if (!kind) {
            const label = scriptLanguage(input.language).label;
            return finish('module', null, null, [{ severity: 'error', message: `O compilador ${label} ainda não está disponível nesta versão da engine; o script fica na biblioteca mas não roda.`, line: 1, column: 1, source: 'Compilador' }], []);
        }
        try {
            switch (kind) {
                case 'module': {
                    if (isForeignLanguage(input.language))
                        return this.compileForeign(input, kind, finish);
                    const project = this.project;
                    if (!project)
                        throw new Error('Projeto TypeScript não inicializado.');
                    return project.compile(input.assetId).then((emit) => finish('module', emit.code, emit.sourceMap, [...emit.diagnostics, ...this.dependencyDiagnostics(emit.dependencies, input)], emit.dependencies), (cause: unknown) => finish('module', null, null, [{ severity: 'error', message: `Falha interna do compilador: ${cause instanceof Error ? cause.message : String(cause)}`, line: 1, column: 1, source: 'Compilador' }], []));
                }
                case 'foreign':
                case 'shader':
                    return this.compileForeign(input, kind, finish);
                case 'html':
                    return finishWeb(finish, 'html', compileHtml(input.source));
                case 'css':
                    return finishWeb(finish, 'css', compileCss(input.source));
                case 'svg':
                    return finishWeb(finish, 'svg', compileSvg(input.source));
                case 'json':
                    return finishWeb(finish, 'json', compileJson(input.source));
                case 'toml':
                    return finishWeb(finish, 'toml', compileToml(input.source));
            }
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            return finish(kind, null, null, [{ severity: 'error', message: `Falha interna do compilador: ${message}`, line: 1, column: 1, source: 'Compilador' }], []);
        }
    }
    private compileForeign(input: ScriptSourceInput, kind: CompiledKind, finish: Finish): CompiledScript | Promise<CompiledScript> {
        const label = scriptLanguage(input.language).label;
        const engine = loadedLanguageEngine(input.language);
        if (!engine) {
            const reason = this.engineFailures.get(input.language);
            const message = reason ? `O compilador ${label} não pôde ser carregado (${reason}). Compile de novo quando ele estiver disponível.` : `O compilador ${label} ainda não terminou de carregar; compile de novo em instantes.`;
            return finish(kind, null, null, [{ severity: 'error', message, line: 1, column: 1, code: 'runtime-unavailable', source: 'Compilador' }], []);
        }
        const siblings = this.siblingsOf(input.assetId, engine.languages);
        const settle = (output: ForeignCompileOutput): CompiledScript => {
            const diagnostics = [...output.diagnostics, ...this.dependencyDiagnostics(output.dependencies, input)];
            return finish(kind, output.code ?? null, output.sourceMap ?? null, diagnostics, output.dependencies, output.artifact);
        };
        const internalFailure = (cause: unknown): CompiledScript => {
            const message = cause instanceof Error ? cause.message : String(cause);
            return finish(kind, null, null, [{ severity: 'error', message: `Falha interna do compilador: ${message}`, line: 1, column: 1, source: 'Compilador' }], []);
        };
        const output = engine.compile({ assetId: input.assetId, name: input.name, file: scriptFileName(input.name, input.language), source: input.source, siblings });
        if (output instanceof Promise)
            return output.then(settle, internalFailure);
        return settle(output);
    }
    dependencyDiagnostics(dependencies: readonly string[], input: Pick<ScriptSourceInput, 'assetId' | 'name' | 'language'>): CompileDiagnostic[] {
        const diagnostics: CompileDiagnostic[] = [];
        for (const specifier of dependencies) {
            if (specifier === 'helix' || specifier === '@helix/engine')
                continue;
            const resolved = this.resolveScript(specifier);
            if (resolved) {
                if (resolved.assetId === input.assetId) {
                    diagnostics.push({ severity: 'error', message: `"${input.name}" importa a si mesmo ("${specifier}").`, line: 1, column: 1, code: 'self-import', source: 'Módulos' });
                }
                continue;
            }
            if (input.language === 'typescript')
                continue;
            const suggestion = closestName(specifier, this.scriptNames);
            diagnostics.push({
                severity: 'error',
                message: `Módulo "${specifier}" não encontrado na biblioteca.${suggestion ? ` Você quis dizer "${suggestion}"?` : ''}`,
                line: 1,
                column: 1,
                code: 'unresolved-import',
                source: 'Módulos',
            });
        }
        return diagnostics;
    }
}
function describe(input: ScriptSourceInput): ResolvedScript {
    return { assetId: input.assetId, name: input.name, language: input.language };
}
function finishWeb(finish: Finish, kind: CompiledKind, output: WebCompileOutput): CompiledScript {
    return finish(kind, null, null, output.diagnostics, output.dependencies);
}
export function closestName(target: string, names: readonly string[]): string | null {
    const normalized = stripSpecifierExtension(target.replace(/^\.?\//, '')).toLowerCase();
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const name of names) {
        const distance = editDistance(normalized, name.toLowerCase());
        if (distance < bestDistance && distance <= Math.max(2, Math.floor(name.length / 3))) {
            best = name;
            bestDistance = distance;
        }
    }
    return best;
}
function editDistance(a: string, b: string): number {
    if (a === b)
        return 0;
    const previous = new Array<number>(b.length + 1);
    const current = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++)
        previous[j] = j;
    for (let i = 1; i <= a.length; i++) {
        current[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j++)
            previous[j] = current[j];
    }
    return previous[b.length];
}
