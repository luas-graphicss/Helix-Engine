import { ENGINE_NAME, ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
import type { LogEntry } from '@/engine/editor/session/editor-log';
import { formatLogEntries, isNoteworthy } from '@/engine/editor/session/log-text';
import type { LanguageTestResult, LanguageTestStatus } from './batch-types';
export const STATUS_LABEL: Record<LanguageTestStatus, string> = {
    passed: 'OK',
    issues: 'COM PROBLEMAS',
    'install-failed': 'NÃO INSTALOU',
    'compile-failed': 'NÃO COMPILOU',
    'runtime-failed': 'NÃO INICIOU',
    interrupted: 'INTERROMPIDO',
    cancelled: 'CANCELADO',
};
function times(count: number): string {
    return count === 1 ? '1 vez' : `${count} vezes`;
}
export function isGameSummary(entry: LogEntry): boolean {
    return entry.source === 'Debug' && entry.message.startsWith('API percorrida');
}
export function isReportable(entry: LogEntry): boolean {
    return isNoteworthy(entry) || isGameSummary(entry);
}
export function countLevel(entries: readonly LogEntry[], level: LogEntry['level']): number {
    return entries.reduce((total, entry) => (entry.level === level ? total + entry.repeat : total), 0);
}
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
export function formatDuration(ms: number): string {
    if (ms < 1000)
        return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60)
        return `${seconds.toFixed(1).replace('.', ',')} s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min ${Math.round(seconds % 60)} s`;
}
export interface BatchSummary {
    readonly total: number;
    readonly passed: number;
    readonly withIssues: number;
    readonly failed: number;
    readonly interrupted: number;
    readonly cancelled: number;
    readonly errors: number;
    readonly warnings: number;
}
export function hasBrokenPasses(summary: BatchSummary): boolean {
    return summary.failed > 0 || summary.interrupted > 0;
}
export function summarizeResults(results: readonly LanguageTestResult[]): BatchSummary {
    return results.reduce<BatchSummary>((summary, result) => ({
        total: summary.total + 1,
        passed: summary.passed + (result.status === 'passed' ? 1 : 0),
        withIssues: summary.withIssues + (result.status === 'issues' ? 1 : 0),
        failed: summary.failed + (result.status === 'install-failed' || result.status === 'compile-failed' || result.status === 'runtime-failed' ? 1 : 0),
        interrupted: summary.interrupted + (result.status === 'interrupted' ? 1 : 0),
        cancelled: summary.cancelled + (result.status === 'cancelled' ? 1 : 0),
        errors: summary.errors + result.errors,
        warnings: summary.warnings + result.warnings,
    }), { total: 0, passed: 0, withIssues: 0, failed: 0, interrupted: 0, cancelled: 0, errors: 0, warnings: 0 });
}
export function describeSummary(summary: BatchSummary): string {
    const parts: string[] = [];
    if (summary.passed > 0)
        parts.push(`${summary.passed} OK`);
    if (summary.withIssues > 0)
        parts.push(`${summary.withIssues} com problemas`);
    if (summary.failed > 0)
        parts.push(`${summary.failed} ${summary.failed === 1 ? 'não chegou ao fim' : 'não chegaram ao fim'}`);
    if (summary.interrupted > 0)
        parts.push(`${summary.interrupted} ${summary.interrupted === 1 ? 'interrompida' : 'interrompidas'} pela recarga da aba`);
    if (summary.cancelled > 0)
        parts.push(`${summary.cancelled} ${summary.cancelled === 1 ? 'cancelada' : 'canceladas'}`);
    const outcome = parts.length > 0 ? parts.join(', ') : 'nenhuma passada';
    return `${outcome} · ${plural(summary.errors, 'erro', 'erros')}, ${plural(summary.warnings, 'aviso', 'avisos')}`;
}
export function describeResult(result: LanguageTestResult): string {
    return `${STATUS_LABEL[result.status]} · ${plural(result.errors, 'erro', 'erros')}, ${plural(result.warnings, 'aviso', 'avisos')} · ${formatDuration(result.durationMs)}`;
}
export function formatLanguageReport(result: LanguageTestResult): string {
    const lines = [`── ${result.label} ── ${describeResult(result)}`];
    if (result.compileMessage)
        lines.push(`  compilação: ${result.compileMessage}`);
    if (result.runtimeMessage)
        lines.push(`  playtest: ${result.runtimeMessage}`);
    if (result.reloads > 0 && result.status !== 'interrupted')
        lines.push(`  aba: recarregou ${times(result.reloads)} no meio desta passada; o lote a retomou do checkpoint e esta é a tentativa que terminou.`);
    if (result.entries.length === 0)
        lines.push('  (nenhum aviso ou erro)');
    else
        lines.push(...formatLogEntries(result.entries).split('\n').map((line) => `  ${line}`));
    return lines.join('\n');
}
export interface BatchReportContext {
    readonly startedAt: Date;
    readonly durationMs: number;
    readonly cancelled: boolean;
    readonly reloads: number;
}
export function formatBatchReport(results: readonly LanguageTestResult[], context: BatchReportContext): string {
    const summary = summarizeResults(results);
    const when = context.startedAt.toLocaleString('pt-BR');
    const notes = [context.cancelled ? 'cancelado antes do fim' : null, context.reloads > 0 ? `a aba recarregou ${times(context.reloads)} e o lote retomou do checkpoint` : null].filter((note): note is string => note !== null);
    const header = [
        `${ENGINE_NAME} ${ENGINE_VERSION_LABEL} · teste automático da API em ${plural(summary.total, 'linguagem', 'linguagens')} · ${when}${notes.map((note) => ` · ${note}`).join('')}`,
        `Resumo: ${describeSummary(summary)} · ${formatDuration(context.durationMs)}`,
        '',
    ];
    return [...header, ...results.map((result) => formatLanguageReport(result))].join('\n\n').trimEnd();
}
