import type { LogLevel, LogLocation } from '@/engine/editor/session/editor-log';
import { isExecutableKind, type CompiledScript } from '../compiler/compile-types';
import { ensureLanguageEngine, type ForeignGame, type ForeignGameHost, type ForeignLocation } from '../languages/language-engine';
import { scriptFileName } from '../script-document';
import { scriptLanguage, type ScriptLanguageId } from '../script-languages';
import type { ScriptOwner } from './runtime-context';
import { describeThrown } from './script-errors';
export function toLogLocation(location: ForeignLocation | null): LogLocation | null {
    if (!location?.assetId)
        return null;
    return { assetId: location.assetId, file: location.file, line: location.line, column: location.column };
}
export interface ForeignGameServices {
    helix(): Record<string, unknown>;
    compiledScripts(): Iterable<CompiledScript>;
    compiledById(assetId: string): CompiledScript | null;
    resolveScript(specifier: string): {
        assetId: string;
    } | null;
    loadExports(target: CompiledScript): unknown;
    console(level: LogLevel, message: string, location: ForeignLocation | null): void;
    currentOwner(): ScriptOwner | null;
    invoke<T>(owner: ScriptOwner | null, label: string, fn: () => T): T | undefined;
    report(level: LogLevel, message: string): void;
}
export class ForeignGames {
    private readonly games = new Map<ScriptLanguageId, ForeignGame>();
    private readonly starting = new Map<ScriptLanguageId, Promise<ForeignGame | null>>();
    private readonly stack: ForeignGame[] = [];
    private readonly host: ForeignGameHost;
    private generation = 0;
    constructor(private readonly services: ForeignGameServices) {
        this.host = this.createHost();
    }
    get(language: ScriptLanguageId): ForeignGame | null {
        return this.games.get(language) ?? null;
    }
    isStarting(language: ScriptLanguageId): boolean {
        return this.starting.has(language);
    }
    ensure(language: ScriptLanguageId): Promise<ForeignGame | null> {
        const existing = this.games.get(language);
        if (existing)
            return Promise.resolve(existing);
        let pending = this.starting.get(language);
        if (!pending) {
            pending = this.boot(language);
            this.starting.set(language, pending);
            void pending.finally(() => {
                if (this.starting.get(language) === pending)
                    this.starting.delete(language);
            });
        }
        return pending;
    }
    async ensureAll(languages: Iterable<ScriptLanguageId>): Promise<void> {
        await Promise.all(Array.from(new Set(languages), (language) => this.ensure(language)));
    }
    private async boot(language: ScriptLanguageId): Promise<ForeignGame | null> {
        const generation = this.generation;
        try {
            const engine = await ensureLanguageEngine(language);
            const game = await engine.createGame(this.host);
            if (generation !== this.generation) {
                game.dispose();
                return null;
            }
            this.games.set(language, game);
            return game;
        }
        catch (cause) {
            if (generation === this.generation)
                this.services.report('error', `O runtime ${scriptLanguage(language).label} não iniciou nesta execução: ${describeThrown(cause)}`);
            return null;
        }
    }
    callerLocation(): ForeignLocation | null {
        const top = this.stack[this.stack.length - 1];
        return top ? top.callerLocation() : null;
    }
    dispose(): void {
        this.generation++;
        this.stack.length = 0;
        for (const [language, game] of this.games) {
            try {
                game.dispose();
            }
            catch (cause) {
                this.services.report('warn', `O runtime ${scriptLanguage(language).label} falhou ao encerrar: ${describeThrown(cause)}`);
            }
        }
        this.games.clear();
    }
    private createHost(): ForeignGameHost {
        const { services } = this;
        const executable = () => Array.from(services.compiledScripts()).filter((script) => isExecutableKind(script.kind));
        return {
            get helix() {
                return services.helix();
            },
            console: (level, message, location) => services.console(level, message, location),
            resolveScript: (specifier) => {
                const resolved = services.resolveScript(specifier);
                return resolved ? services.compiledById(resolved.assetId) : null;
            },
            compiledById: (assetId) => services.compiledById(assetId),
            requireForeign: (_from, target) => services.loadExports(target),
            moduleNames: () => executable().map((script) => script.name),
            assetIdOfFile: (file) => executable().find((script) => scriptFileName(script.name, script.language) === file)?.assetId ?? null,
            enter: (game) => {
                this.stack.push(game);
            },
            exit: (game) => {
                const index = this.stack.lastIndexOf(game);
                if (index !== -1)
                    this.stack.splice(index, 1);
            },
            currentOwner: () => services.currentOwner(),
            invoke: (owner, label, fn) => services.invoke(owner, label, fn),
        };
    }
}
