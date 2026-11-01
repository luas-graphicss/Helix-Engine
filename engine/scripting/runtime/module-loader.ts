import { isDataKind, type CompiledScript } from '../compiler/compile-types';
import { closestName } from '../compiler/script-compiler';
import type { ForeignGame } from '../languages/language-engine';
import { parseTomlOrThrow } from '../languages/toml/toml-parser';
import { scriptFileName } from '../script-document';
import { scriptLanguage, type ScriptLanguageId } from '../script-languages';
import { builtinModule } from './builtin-modules';
import { createModuleFactory, explainedGlobalValues, INERT_DEBUG_HOOK, MANAGED_GLOBALS, type ModuleDebugHook, type ModuleFactory } from './sandbox';
import { HelixModuleError, describeThrown } from './script-errors';
import { StackMapper } from './stack-mapper';
import type { Scheduler } from './scheduler';
import type { ScriptOwner } from './runtime-context';
export interface LoadedModule {
    readonly compiled: CompiledScript;
    readonly sourceUrl: string;
    readonly file: string;
    readonly exports: Record<string, unknown>;
    readonly owner: ModuleOwner;
    state: 'attached' | 'loading' | 'loaded' | 'failed';
    error: unknown;
}
export class ModuleOwner implements ScriptOwner {
    private static nextId = 1;
    readonly id = ModuleOwner.nextId++;
    active = true;
    private readonly disposers = new Set<() => void>();
    constructor(readonly name: string) { }
    track(dispose: () => void): () => void {
        this.disposers.add(dispose);
        return dispose;
    }
    dispose(): void {
        this.active = false;
        for (const dispose of Array.from(this.disposers)) {
            try {
                dispose();
            }
            catch {
            }
        }
        this.disposers.clear();
    }
}
export interface ModuleLoaderServices {
    readonly stacks: StackMapper;
    readonly scheduler: Scheduler;
    readonly helixModule: Record<string, unknown>;
    createConsole(module: LoadedModule): Console;
    compiledOf(assetId: string): CompiledScript | null;
    resolve(specifier: string): {
        assetId: string;
        name: string;
    } | null;
    currentOwner(): ScriptOwner | null;
    moduleNames(): string[];
    foreignGame(language: ScriptLanguageId): ForeignGame | null;
    debugHook?(module: LoadedModule): ModuleDebugHook;
}
export class ModuleLoader {
    private readonly modules = new Map<string, LoadedModule>();
    private readonly loading: string[] = [];
    constructor(private readonly services: ModuleLoaderServices) { }
    get loaded(): readonly LoadedModule[] {
        return Array.from(this.modules.values());
    }
    get(assetId: string): LoadedModule | null {
        return this.modules.get(assetId) ?? null;
    }
    attach(compiled: CompiledScript): LoadedModule {
        const existing = this.modules.get(compiled.assetId);
        if (existing)
            return existing;
        const file = scriptFileName(compiled.name, compiled.language);
        const module: LoadedModule = { compiled, sourceUrl: StackMapper.sourceUrl(file), file, exports: {}, owner: new ModuleOwner(compiled.name), state: 'attached', error: null };
        this.modules.set(compiled.assetId, module);
        return module;
    }
    load(compiled: CompiledScript): LoadedModule {
        const existing = this.modules.get(compiled.assetId);
        if (existing && existing.state !== 'attached') {
            if (existing.state === 'loading')
                throw this.cycleError(compiled.name);
            if (existing.state === 'failed')
                throw new HelixModuleError(`${existing.file} falhou ao carregar: ${describeThrown(existing.error)}`);
            return existing;
        }
        if (compiled.kind === 'foreign')
            return this.loadForeign(compiled, existing ?? this.attach(compiled));
        if (isDataKind(compiled.kind))
            return this.loadData(compiled);
        if (compiled.kind !== 'module' || !compiled.code) {
            throw new HelixModuleError(compiled.kind === 'module'
                ? `${compiled.name} não compilou; corrija os erros antes de importá-lo.`
                : compiled.kind === 'shader'
                    ? `${compiled.name} é um shader e não se importa como módulo; ligue-o com helix.post.custom.add("${compiled.name}") ou helix.material.fromShader(material, "${compiled.name}").`
                    : `${compiled.name} é ${compiled.kind.toUpperCase()} e não pode ser importado como módulo; use helix.assets ou helix.gui.html.`);
        }
        const file = scriptFileName(compiled.name, compiled.language);
        const sourceUrl = StackMapper.sourceUrl(file);
        const module: LoadedModule = { compiled, sourceUrl, file, exports: {}, owner: new ModuleOwner(compiled.name), state: 'loading', error: null };
        this.modules.set(compiled.assetId, module);
        const debugHook = this.services.debugHook?.(module) ?? INERT_DEBUG_HOOK;
        let debugging = debugHook !== INERT_DEBUG_HOOK && typeof compiled.debugCode === 'string';
        this.services.stacks.register(sourceUrl, { assetId: compiled.assetId, file, sourceMap: debugging ? (compiled.debugSourceMap ?? compiled.sourceMap) : compiled.sourceMap });
        this.loading.push(compiled.name);
        let factory: ModuleFactory;
        try {
            try {
                factory = createModuleFactory(debugging ? compiled.debugCode! : compiled.code, sourceUrl, compiled.name);
            }
            catch (cause) {
                if (!debugging)
                    throw cause;
                debugging = false;
                this.services.stacks.register(sourceUrl, { assetId: compiled.assetId, file, sourceMap: compiled.sourceMap });
                factory = createModuleFactory(compiled.code, sourceUrl, compiled.name);
            }
        }
        catch (cause) {
            this.loading.pop();
            module.state = 'failed';
            module.error = cause;
            throw cause;
        }
        const moduleRecord = { exports: module.exports, id: compiled.assetId, filename: file, loaded: false };
        const require = (specifier: unknown) => this.require(module, specifier);
        const managed = this.services.scheduler.managedGlobals(() => this.services.currentOwner() ?? module.owner);
        const args: unknown[] = [require, moduleRecord, module.exports, this.services.helixModule, this.services.createConsole(module), debugging ? debugHook : INERT_DEBUG_HOOK, ...MANAGED_GLOBALS.map((name) => managed[name]), ...explainedGlobalValues()];
        try {
            factory(...args);
            if (moduleRecord.exports !== module.exports)
                Object.assign(module.exports, moduleRecord.exports as Record<string, unknown>);
            moduleRecord.loaded = true;
            module.state = 'loaded';
        }
        catch (cause) {
            module.state = 'failed';
            module.error = cause;
            throw cause;
        }
        finally {
            this.loading.pop();
        }
        return module;
    }
    private loadForeign(compiled: CompiledScript, module: LoadedModule): LoadedModule {
        if (!compiled.artifact)
            throw new HelixModuleError(`${compiled.name} não compilou; corrija os erros antes de importá-lo.`);
        const game = this.services.foreignGame(compiled.language);
        if (!game)
            throw new HelixModuleError(`${module.file}: o runtime ${scriptLanguage(compiled.language).label} não iniciou neste jogo.`);
        module.state = 'loading';
        this.loading.push(compiled.name);
        try {
            const value = game.loadModule(compiled);
            if (value !== null && typeof value === 'object' && !Array.isArray(value))
                Object.assign(module.exports, value as Record<string, unknown>);
            else if (value !== undefined)
                Object.assign(module.exports, { __esModule: true, default: value });
            module.state = 'loaded';
        }
        catch (cause) {
            module.state = 'failed';
            module.error = cause;
            throw cause;
        }
        finally {
            this.loading.pop();
        }
        return module;
    }
    private loadData(compiled: CompiledScript): LoadedModule {
        if (compiled.errorCount > 0)
            throw new HelixModuleError(`${compiled.name} não compilou; corrija os erros do ${compiled.kind.toUpperCase()} antes de importá-lo.`);
        const file = scriptFileName(compiled.name, compiled.language);
        const module: LoadedModule = { compiled, sourceUrl: StackMapper.sourceUrl(file), file, exports: {}, owner: new ModuleOwner(compiled.name), state: 'loading', error: null };
        this.modules.set(compiled.assetId, module);
        try {
            const data: unknown = compiled.kind === 'toml' ? parseTomlOrThrow(compiled.source) : compiled.source.trim().length === 0 ? null : JSON.parse(compiled.source);
            if (data !== null && typeof data === 'object' && !Array.isArray(data))
                Object.assign(module.exports, data as Record<string, unknown>);
            Object.defineProperties(module.exports, {
                __esModule: { value: true },
                default: { value: data, enumerable: true },
            });
            module.state = 'loaded';
        }
        catch (cause) {
            module.state = 'failed';
            module.error = cause;
            throw new HelixModuleError(`${file}: ${describeThrown(cause)}`);
        }
        return module;
    }
    require(from: LoadedModule, specifier: unknown): unknown {
        if (typeof specifier !== 'string' || specifier.length === 0)
            throw new HelixModuleError(`${from.file}: require() precisa de um nome de módulo em texto.`);
        if (specifier === 'helix' || specifier === '@helix/engine')
            return this.services.helixModule;
        const builtin = builtinModule(specifier);
        if (builtin !== undefined)
            return builtin;
        const resolved = this.services.resolve(specifier);
        if (!resolved) {
            const suggestion = closestName(specifier, this.services.moduleNames());
            throw new HelixModuleError(`${from.file} importa "${specifier}", que não existe na biblioteca.${suggestion ? ` Você quis dizer "${suggestion}"?` : ' Os módulos importáveis são os scripts de código do projeto, em qualquer linguagem, pelo nome.'}`);
        }
        const target = this.modules.get(resolved.assetId);
        if (target?.state === 'loading')
            throw this.cycleError(resolved.name);
        const compiled = this.services.compiledOf(resolved.assetId);
        if (!compiled)
            throw new HelixModuleError(`${from.file} importa "${resolved.name}", que não foi compilado para este jogo (o ator que o carrega pode estar desativado).`);
        return this.load(compiled).exports;
    }
    unload(assetId: string): void {
        const module = this.modules.get(assetId);
        if (!module)
            return;
        module.owner.dispose();
        this.services.stacks.unregister(module.sourceUrl);
        if (module.compiled.kind === 'foreign')
            this.services.foreignGame(module.compiled.language)?.unloadModule(assetId);
        this.modules.delete(assetId);
    }
    clear(): void {
        for (const assetId of Array.from(this.modules.keys()))
            this.unload(assetId);
        this.loading.length = 0;
    }
    dependentsOf(assetId: string): LoadedModule[] {
        const dependents: LoadedModule[] = [];
        const target = this.modules.get(assetId);
        if (!target)
            return dependents;
        for (const module of this.modules.values()) {
            if (module === target)
                continue;
            const imports = module.compiled.dependencies.some((specifier) => this.services.resolve(specifier)?.assetId === assetId);
            if (imports)
                dependents.push(module);
        }
        return dependents;
    }
    private cycleError(name: string): HelixModuleError {
        const start = this.loading.indexOf(name);
        const chain = [...(start === -1 ? this.loading : this.loading.slice(start)), name];
        return new HelixModuleError(`Importação circular: ${chain.join(' → ')}. Quebre o ciclo movendo o que os dois usam para um terceiro módulo.`);
    }
}
