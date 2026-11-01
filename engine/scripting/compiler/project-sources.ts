import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { CodeDiagnostic } from '@/engine/editor/code/code-editor';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { scriptFileName } from '../script-document';
import { readScriptDocument } from '../script-io';
import { formatLocation, type CompileDiagnostic, type CompiledScript } from './compile-types';
import { isCompilableLanguage, type CompileBatchResult, type ScriptSourceInput } from './script-compiler';
export function hashSource(text: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `live-${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
}
export async function scriptSourceInput(session: EditorSession, asset: LibraryAsset): Promise<ScriptSourceInput | null> {
    if (asset.kind !== 'script' || asset.details.kind !== 'script')
        return null;
    const details = asset.details;
    if (!isCompilableLanguage(details.language))
        return null;
    const tab = session.code.tab(asset.id);
    if (tab) {
        const { document } = tab;
        const dirty = session.code.isDirty(tab);
        return {
            assetId: asset.id,
            name: asset.name,
            language: document.language,
            source: document.source,
            runContext: document.runContext,
            contentHash: dirty ? hashSource(document.source) : asset.contentHash,
        };
    }
    const file = await session.library.primaryFile(asset);
    const document = await readScriptDocument(file, details);
    return { assetId: asset.id, name: asset.name, language: details.language, source: document.source, runContext: details.runContext, contentHash: asset.contentHash };
}
export async function collectScriptSources(session: EditorSession): Promise<{
    inputs: ScriptSourceInput[];
    skipped: LibraryAsset[];
}> {
    const inputs: ScriptSourceInput[] = [];
    const skipped: LibraryAsset[] = [];
    for (const asset of session.library.byKind('script')) {
        const input = await scriptSourceInput(session, asset);
        if (input)
            inputs.push(input);
        else
            skipped.push(asset);
    }
    return { inputs, skipped };
}
export function toScriptCodeDiagnostics(assetId: string, diagnostics: readonly CompileDiagnostic[]): CodeDiagnostic[] {
    return diagnostics.map((diagnostic, index) => ({
        id: `${assetId}:${index}:${diagnostic.line}:${diagnostic.column}`,
        assetId,
        severity: diagnostic.severity,
        line: diagnostic.line,
        column: diagnostic.column,
        endLine: diagnostic.endLine,
        endColumn: diagnostic.endColumn,
        message: diagnostic.message,
        code: diagnostic.code,
        source: diagnostic.source,
    }));
}
export function toCodeDiagnostics(compiled: readonly CompiledScript[]): CodeDiagnostic[] {
    return compiled.flatMap((script) => toScriptCodeDiagnostics(script.assetId, script.diagnostics));
}
export interface CompileSummary {
    readonly errors: number;
    readonly warnings: number;
    readonly failed: CompiledScript[];
}
export function publishCompileResult(session: EditorSession, result: CompileBatchResult, options: {
    source: string;
    skipped?: readonly LibraryAsset[];
    silent?: boolean;
}): CompileSummary {
    const { code, log } = session;
    const failed = result.compiled.filter((script) => script.errorCount > 0);
    const errors = result.compiled.reduce((total, script) => total + script.errorCount, 0);
    const warnings = result.compiled.reduce((total, script) => total + script.warningCount, 0);
    code.setDiagnostics(toCodeDiagnostics(result.compiled));
    for (const script of failed) {
        const first = script.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
        const file = scriptFileName(script.name, script.language);
        const where = first ? formatLocation(file, first.line, first.column) : file;
        log.error(options.source, `${where}: ${first?.message ?? 'falhou ao compilar'}${script.errorCount > 1 ? ` (+${script.errorCount - 1} ${script.errorCount - 1 === 1 ? 'erro' : 'erros'})` : ''}`, first ? { location: { assetId: script.assetId, file, line: first.line, column: first.column } } : undefined);
    }
    const total = result.compiled.length;
    const parts = [`${total} ${total === 1 ? 'script' : 'scripts'}`];
    if (result.reused > 0)
        parts.push(`${result.reused} do cache`);
    if (warnings > 0)
        parts.push(`${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}`);
    if (options.skipped && options.skipped.length > 0)
        parts.push(`${options.skipped.length} sem compilador (${options.skipped.map((asset) => asset.name).join(', ')})`);
    const duration = `${Math.max(1, Math.round(result.durationMs))} ms`;
    if (errors > 0) {
        code.setCompileState('failed', `${errors} ${errors === 1 ? 'erro' : 'erros'} em ${failed.length} ${failed.length === 1 ? 'script' : 'scripts'} · ${parts.join(' · ')} · ${duration}`);
    }
    else {
        code.setCompileState('ok', `${parts.join(' · ')} · ${duration}`);
        if (!options.silent)
            log.info(options.source, `Compilação concluída: ${parts.join(', ')} em ${duration}.`);
    }
    return { errors, warnings, failed };
}
