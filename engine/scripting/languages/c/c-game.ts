import type { LogLevel } from '@/engine/editor/session/editor-log';
import type { CompiledScript } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import { HelixError, isTaskCancelled } from '../../runtime/script-errors';
import type { InjectedFields } from '../../runtime/script-instance';
import { scriptFileName } from '../../script-document';
import type { ScriptLanguageId } from '../../script-languages';
import { ForeignScriptError, hookNameOf } from '../foreign-values';
import type { ForeignGame, ForeignGameHost, ForeignLocation } from '../language-engine';
import { HandleError } from './wasm-handles';
import { demangle } from './wasm-names';
import { LOG_LEVELS, WasmProgram, WasmScriptThrow, type WasmProgramHost } from './wasm-program';
import { WasmExit } from './wasm-wasi';
interface ProgramInfo {
    readonly assetId: string;
    readonly file: string;
    readonly language: ScriptLanguageId;
}
export interface WasmModuleSource {
    moduleFor(artifact: Uint8Array): WebAssembly.Module;
}
export interface CrashReport {
    readonly message: string;
    readonly location: ForeignLocation | null;
    readonly traceback: string | null;
}
export interface WasmFlavor {
    errorName(language: ScriptLanguageId): string;
    describeTrap(message: string): string;
    readonly captureStderr: boolean;
    parseCrash?(stderr: readonly string[], info: {
        readonly file: string;
        readonly cause: unknown;
    }): CrashReport | null;
}
export const C_FLAVOR: WasmFlavor = {
    errorName: (language) => (language === 'cpp' ? 'Erro de C++' : 'Erro de C'),
    describeTrap: describeCTrap,
    captureStderr: false,
};
export class WasmGame implements ForeignGame {
    readonly language: ScriptLanguageId;
    private readonly shared = new Map<string, {
        program: WasmProgram;
        exports: Record<string, unknown>;
    }>();
    private readonly programs = new Map<WasmProgram, ProgramInfo>();
    private readonly stack: WasmProgram[] = [];
    private readonly startedAt = now();
    private stderr: string[] = [];
    private disposed = false;
    constructor(private readonly host: ForeignGameHost, private readonly engine: WasmModuleSource, private readonly flavor: WasmFlavor = C_FLAVOR, language: ScriptLanguageId = 'c') {
        this.language = language;
    }
    loadModule(compiled: CompiledScript): unknown {
        const existing = this.shared.get(compiled.assetId);
        if (existing)
            return existing.exports;
        const program = this.createProgram(compiled, {
            root: () => this.host.helix,
            script: () => null,
            self: () => null,
        });
        if (!program)
            return {};
        this.start(program);
        const exports: Record<string, unknown> = {};
        for (const name of program.functionNames()) {
            exports[name] = (...args: unknown[]) => this.call(program, name, args, { forValue: true });
        }
        this.shared.set(compiled.assetId, { program, exports });
        return exports;
    }
    instantiate(compiled: CompiledScript, inject: InjectedFields): Record<string, unknown> {
        const helix = inject.helix as Record<string, unknown>;
        const program = this.createProgram(compiled, {
            root: () => helix,
            script: () => inject.script,
            self: () => helix.self ?? inject.entity,
        });
        if (!program)
            return {};
        this.start(program);
        const hooks: Record<string, unknown> = {};
        for (const name of program.functionNames()) {
            const hook = hookNameOf(name);
            if (!hook)
                continue;
            hooks[hook] = (...args: unknown[]) => this.call(program, name, args);
        }
        const scriptedDestroy = hooks.onDestroy as ((...args: unknown[]) => unknown) | undefined;
        hooks.onDestroy = (...args: unknown[]) => {
            try {
                return scriptedDestroy?.(...args);
            }
            finally {
                this.release(program);
            }
        };
        return hooks;
    }
    unloadModule(assetId: string): void {
        const entry = this.shared.get(assetId);
        if (!entry)
            return;
        this.shared.delete(assetId);
        this.release(entry.program);
    }
    callerLocation(): ForeignLocation | null {
        return null;
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.shared.clear();
        for (const program of Array.from(this.programs.keys()))
            this.release(program);
    }
    private createProgram(compiled: CompiledScript, context: {
        root(): unknown;
        script(): unknown;
        self(): unknown;
    }): WasmProgram | null {
        const file = scriptFileName(compiled.name, compiled.language);
        if (!compiled.artifact)
            throw new HelixError(`${file} não compilou; corrija os erros antes de executá-lo.`);
        if (compiled.artifact.length === 0)
            return null;
        const module = this.engine.moduleFor(compiled.artifact);
        const info: ProgramInfo = { assetId: compiled.assetId, file, language: compiled.language };
        const host: WasmProgramHost = {
            get root() {
                return context.root();
            },
            get script() {
                return context.script();
            },
            get self() {
                return context.self();
            },
            require: (name) => this.require(info, name),
            log: (level, message) => this.console(LOG_LEVELS[level] ?? 'info', message),
            write: (fd, line) => this.write(fd, line),
            now: () => (now() - this.startedAt) / 1000,
            enter: () => {
                this.stack.push(program);
                this.host.enter(this);
            },
            exit: () => {
                this.host.exit(this);
                const index = this.stack.lastIndexOf(program);
                if (index !== -1)
                    this.stack.splice(index, 1);
                if (this.stack.length === 0 && this.stderr.length > 0)
                    queueMicrotask(() => this.flushStderr());
            },
        };
        let program: WasmProgram;
        try {
            program = new WasmProgram(module, host);
        }
        catch (cause) {
            throw new HelixError(`${file} não pôde ser instanciado: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
        this.programs.set(program, info);
        return program;
    }
    private start(program: WasmProgram): void {
        const info = this.programs.get(program)!;
        let code: number;
        try {
            code = program.start();
        }
        catch (cause) {
            if (cause instanceof WasmExit && cause.code === 0)
                return;
            throw this.scriptError(cause, info);
        }
        this.flushStderr();
        if (code !== 0)
            throw new ForeignScriptError(`main devolveu ${code}.`, this.flavor.errorName(info.language), null, null);
    }
    private call(program: WasmProgram, name: string, args: readonly unknown[], options: {
        forValue?: boolean;
    } = {}): unknown {
        if (this.disposed || program.isDisposed || program.exitCode !== null)
            return undefined;
        const info = this.programs.get(program)!;
        try {
            const result = options.forValue ? program.invokeForValue(name, args) : program.invoke(name, args);
            this.flushStderr();
            return result;
        }
        catch (cause) {
            if (cause instanceof WasmExit && cause.code === 0) {
                this.flushStderr();
                this.console('info', `${info.file} chamou exit(0): o script não roda mais nesta execução.`);
                return undefined;
            }
            throw this.scriptError(cause, info);
        }
    }
    private release(program: WasmProgram): void {
        this.programs.delete(program);
        try {
            program.dispose();
        }
        catch {
        }
    }
    private console(level: LogLevel, message: string): void {
        this.host.console(level, message, null);
    }
    private write(fd: 1 | 2, line: string): void {
        if (fd === 2 && this.flavor.captureStderr && this.stack.length > 0) {
            this.stderr.push(line);
            return;
        }
        this.console(fd === 1 ? 'info' : 'warn', line);
    }
    private flushStderr(): void {
        if (this.stderr.length === 0)
            return;
        const lines = this.stderr;
        this.stderr = [];
        for (const line of lines)
            this.console('warn', line);
    }
    private takeStderr(): string[] {
        const lines = this.stderr;
        this.stderr = [];
        return lines;
    }
    private require(from: ProgramInfo, name: string): unknown {
        if (!name)
            throw new HelixError('require precisa do nome de um script da biblioteca.');
        const target = this.host.resolveScript(name);
        if (!target) {
            const suggestion = closestName(name, this.host.moduleNames());
            throw new HelixError(`"${name}" não existe na biblioteca.${suggestion ? ` Você quis dizer "${suggestion}"?` : ' Os módulos importáveis são os scripts do projeto, pelo nome.'}`);
        }
        if (target.assetId === from.assetId)
            throw new HelixError(`${from.file} não pode importar a si mesmo.`);
        return this.host.requireForeign(this.host.compiledById(from.assetId), target);
    }
    private scriptError(cause: unknown, info: ProgramInfo): unknown {
        if (isTaskCancelled(cause) || cause instanceof ForeignScriptError)
            return cause;
        const name = this.flavor.errorName(info.language);
        const stderr = this.takeStderr();
        const crash = this.flavor.parseCrash?.(stderr, { file: info.file, cause }) ?? null;
        if (crash)
            return new ForeignScriptError(crash.message, name, this.locate(crash.location), crash.traceback ?? wasmTraceback(cause));
        const traceback = [...stderr, ...(wasmTraceback(cause) ? [wasmTraceback(cause)!] : [])].join('\n') || null;
        if (cause instanceof WasmExit)
            return new ForeignScriptError(`o script chamou exit(${cause.code}).`, name, null, traceback);
        if (cause instanceof WasmScriptThrow)
            return new ForeignScriptError(cause.message, name, null, traceback);
        if (cause instanceof HandleError)
            return new ForeignScriptError(cause.message, `${name} (helix)`, null, traceback);
        if (cause instanceof WebAssembly.RuntimeError)
            return new ForeignScriptError(this.flavor.describeTrap(cause.message), name, null, traceback);
        if (cause instanceof RangeError && /call stack/i.test(cause.message))
            return new ForeignScriptError('estouro de pilha: recursão sem fim ou arrays locais grandes demais.', name, null, traceback);
        if (cause instanceof Error)
            return new ForeignScriptError(cause.message, cause instanceof HelixError ? name : `${name} (${cause.name})`, null, traceback);
        return new ForeignScriptError(String(cause), name, null, traceback);
    }
    private locate(location: ForeignLocation | null): ForeignLocation | null {
        if (!location)
            return null;
        return { ...location, assetId: location.assetId ?? this.host.assetIdOfFile(location.file) };
    }
}
export { WasmGame as CGame };
function now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
