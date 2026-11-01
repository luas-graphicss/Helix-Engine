import type { CompileDiagnostic, CompileSeverity } from '../../compiler/compile-types';
import { HelixError } from '../../runtime/script-errors';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ScriptLanguageEngine } from '../language-engine';
import { PhpGame } from './php-game';
import { PhpInstance, type PhpHostFunctions } from './php-runtime';
interface LintDiagnostic {
    readonly severity: CompileSeverity;
    readonly message: string;
    readonly line: number;
    readonly column: number;
    readonly code?: string;
}
interface LintResult {
    readonly diagnostics: readonly LintDiagnostic[];
    readonly dependencies: readonly string[];
}
export function phpEngine(): ScriptLanguageEngine {
    return new PhpEngine();
}
class PhpEngine implements ScriptLanguageEngine {
    readonly label = 'PHP';
    readonly languages = ['php'] as const;
    private linter: PhpInstance | null = null;
    private phpVersion: string | null = null;
    private loading: Promise<void> | null = null;
    get loaded(): boolean {
        return this.linter !== null;
    }
    get version(): string | null {
        return this.phpVersion ? `PHP ${this.phpVersion}` : null;
    }
    load(): Promise<void> {
        if (this.linter)
            return Promise.resolve();
        if (!this.loading) {
            this.loading = this.boot().finally(() => {
                this.loading = null;
            });
        }
        return this.loading;
    }
    private async boot(): Promise<void> {
        const instance = await PhpInstance.boot(inertHost(), (level, text) => {
            if (level === 'error')
                console.warn(`[PHP] ${text.trim()}`);
        });
        const version = instance.call('version');
        this.phpVersion = typeof version === 'string' ? version : null;
        this.linter = instance;
    }
    compile(input: ForeignCompileInput): ForeignCompileOutput | Promise<ForeignCompileOutput> {
        const linter = this.linter;
        if (!linter)
            throw new HelixError('o runtime PHP ainda não foi carregado; chame load() antes de compilar.');
        if (linter.dead) {
            this.linter = null;
            return this.load().then(() => this.compile(input));
        }
        const result = parseLint(linter.call('lint', input.source));
        const diagnostics: CompileDiagnostic[] = result.diagnostics.map((diagnostic) => ({
            severity: diagnostic.severity,
            message: diagnostic.message,
            line: Math.max(1, Number(diagnostic.line) || 1),
            column: Math.max(1, Number(diagnostic.column) || 1),
            ...(diagnostic.code ? { code: diagnostic.code } : {}),
            source: this.label,
        }));
        const failed = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
        return {
            artifact: failed ? null : new TextEncoder().encode(input.source),
            diagnostics,
            dependencies: result.dependencies,
        };
    }
    async createGame(host: ForeignGameHost): Promise<ForeignGame> {
        await this.load();
        return PhpGame.create(host, { boot: (functions, onOutput) => PhpInstance.boot(functions, onOutput) });
    }
}
function parseLint(raw: unknown): LintResult {
    if (typeof raw !== 'string')
        throw new HelixError('o Linter PHP não devolveu um resultado.');
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new HelixError(`o Linter PHP devolveu JSON inválido: ${raw.slice(0, 120)}`);
    }
    const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    const diagnostics = Array.isArray(record.diagnostics) ? (record.diagnostics as LintDiagnostic[]).filter((d) => d && typeof d === 'object' && typeof d.message === 'string') : [];
    const dependencies = Array.isArray(record.dependencies) ? record.dependencies.filter((d): d is string => typeof d === 'string' && d.length > 0) : [];
    return { diagnostics, dependencies };
}
function inertHost(): PhpHostFunctions {
    const refuse = (): never => {
        throw new HelixError('o interpretador de verificação do PHP não executa scripts.');
    };
    return {
        get: refuse,
        set: refuse,
        call: refuse,
        str: refuse,
        len: refuse,
        keys: refuse,
        console: () => undefined,
        resolve: refuse,
        fatal: () => undefined,
    };
}
