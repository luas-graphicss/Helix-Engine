import type { CompileDiagnostic } from '../../compiler/compile-types';
import { parseToml, type TomlTable } from './toml-parser';
export const TOML_SOURCE = 'TOML';
export interface TomlCompileOutput {
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
    readonly data: TomlTable | null;
}
export function compileToml(source: string): TomlCompileOutput {
    const result = parseToml(source);
    const diagnostics: CompileDiagnostic[] = result.diagnostics.map((diagnostic) => ({
        severity: 'error',
        message: diagnostic.message,
        line: diagnostic.line,
        column: diagnostic.column,
        endLine: diagnostic.endLine,
        endColumn: diagnostic.endColumn,
        code: diagnostic.code,
        source: TOML_SOURCE,
    }));
    if (diagnostics.length === 0 && source.trim().length === 0) {
        diagnostics.push({ severity: 'info', message: 'O arquivo TOML está vazio: require() e helix.assets.data devolvem uma tabela sem chaves.', line: 1, column: 1, code: 'empty-document', source: TOML_SOURCE });
    }
    return { diagnostics, dependencies: [], data: result.diagnostics.length === 0 ? result.value : null };
}
