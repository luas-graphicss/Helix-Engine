import type { CompileDiagnostic } from '../../compiler/compile-types';
import { registerBuiltinModule } from '../../runtime/builtin-modules';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ScriptLanguageEngine } from '../language-engine';
import { analyze } from './compiler/analyzer';
import { emit } from './compiler/emitter';
import { parse } from './compiler/parser';
import { BUILTIN_MODULE_NAME, createBuiltinModule } from './runtime';
const LABEL = 'GDScript';
const VERSION = 'GDScript 2.0 (Godot 4)';
export class GdscriptEngine implements ScriptLanguageEngine {
    readonly label = LABEL;
    readonly languages = ['gdscript'] as const;
    private ready = false;
    get loaded(): boolean {
        return this.ready;
    }
    get version(): string | null {
        return this.ready ? VERSION : null;
    }
    async load(): Promise<void> {
        if (this.ready)
            return;
        registerBuiltinModule(BUILTIN_MODULE_NAME, createBuiltinModule);
        this.ready = true;
    }
    compile(input: ForeignCompileInput): ForeignCompileOutput {
        const parsed = parse(input.source);
        const diagnostics: CompileDiagnostic[] = parsed.diagnostics.map((diagnostic) => ({
            severity: 'error',
            message: diagnostic.message,
            line: diagnostic.line,
            column: diagnostic.column,
            endLine: diagnostic.endLine,
            endColumn: diagnostic.endColumn,
            code: 'syntax',
            source: LABEL,
        }));
        const failed = (dependencies: readonly string[] = []): ForeignCompileOutput => ({ artifact: null, code: null, sourceMap: null, diagnostics, dependencies });
        if (diagnostics.length > 0)
            return failed();
        const siblings = (input.siblings ?? []).filter((sibling) => sibling.assetId !== input.assetId);
        const analysis = analyze({ file: parsed.file, fileName: input.file, scriptName: input.name, siblings });
        diagnostics.push(...analysis.diagnostics);
        const program = analysis.program;
        if (!program)
            return failed();
        const emitted = emit({ file: parsed.file, program, fileName: input.file, scriptName: input.name, source: input.source });
        return { artifact: null, code: emitted.code, sourceMap: emitted.sourceMap, diagnostics, dependencies: program.dependencies };
    }
    createGame(): Promise<ForeignGame> {
        return Promise.reject(new Error('GDScript compila para JavaScript e roda no sandbox da engine; não há runtime estrangeiro a iniciar.'));
    }
}
let shared: GdscriptEngine | null = null;
export function gdscriptEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new GdscriptEngine();
    return shared;
}
