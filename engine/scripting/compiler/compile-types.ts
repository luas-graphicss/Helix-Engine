import type { ScriptLanguageId } from '../script-languages';
import type { ScriptRunContext } from '../script-document';
import type { DecodedSourceMap } from './source-map';
export type CompileSeverity = 'error' | 'warning' | 'info';
export interface CompileDiagnostic {
    readonly severity: CompileSeverity;
    readonly message: string;
    readonly line: number;
    readonly column: number;
    readonly endLine?: number;
    readonly endColumn?: number;
    readonly code?: string;
    readonly source: string;
}
export type CompiledKind = 'module' | 'foreign' | 'html' | 'css' | 'svg' | 'json' | 'toml' | 'shader';
export function isExecutableKind(kind: CompiledKind): boolean {
    return kind === 'module' || kind === 'foreign';
}
export function isDataKind(kind: CompiledKind): boolean {
    return kind === 'json' || kind === 'toml';
}
export function isImportableKind(kind: CompiledKind): boolean {
    return isExecutableKind(kind) || isDataKind(kind);
}
export function isShaderKind(kind: CompiledKind): boolean {
    return kind === 'shader';
}
export interface CompiledScript {
    readonly assetId: string;
    readonly name: string;
    readonly language: ScriptLanguageId;
    readonly runContext: ScriptRunContext;
    readonly kind: CompiledKind;
    readonly key: string;
    readonly source: string;
    readonly code: string | null;
    readonly artifact: Uint8Array | null;
    readonly sourceMap: DecodedSourceMap | null;
    readonly debugCode?: string | null;
    readonly debugSourceMap?: DecodedSourceMap | null;
    readonly debugLines?: readonly number[] | null;
    readonly dependencies: readonly string[];
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly errorCount: number;
    readonly warningCount: number;
    readonly durationMs: number;
    readonly compiledAt: number;
}
export function countDiagnostics(diagnostics: readonly CompileDiagnostic[]): {
    errors: number;
    warnings: number;
} {
    let errors = 0;
    let warnings = 0;
    for (const diagnostic of diagnostics) {
        if (diagnostic.severity === 'error')
            errors++;
        else if (diagnostic.severity === 'warning')
            warnings++;
    }
    return { errors, warnings };
}
export function positionAt(text: string, offset: number): {
    line: number;
    column: number;
} {
    const clamped = Math.max(0, Math.min(offset, text.length));
    let line = 1;
    let lineStart = 0;
    for (let index = 0; index < clamped; index++) {
        if (text.charCodeAt(index) === 10) {
            line++;
            lineStart = index + 1;
        }
    }
    return { line, column: clamped - lineStart + 1 };
}
export function formatLocation(name: string, line: number, column?: number): string {
    return column !== undefined && column > 0 ? `${name}:${line}:${column}` : `${name}:${line}`;
}
