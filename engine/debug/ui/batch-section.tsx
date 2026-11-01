'use client';
import { useEffect, useState } from 'react';
import { Ban, Check, CircleAlert, CircleCheck, CircleX, ClipboardCopy, Copy, LoaderCircle, Play, RotateCcw, Square, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { ActionButton } from '@/engine/ui/action-button';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { cn } from '@/lib/utils';
import { testableLanguages } from '../api-test-game/targets';
import { describeResult, describeSummary, formatLanguageReport, hasBrokenPasses, summarizeResults } from '../batch/batch-report';
import { BATCH_STEP_LABEL, SETTLE_PROFILES, type LanguageTestResult, type SettleProfileId } from '../batch/batch-types';
import type { DebugModeController } from '../debug-mode';
import { DebugSection } from './debug-section';
const COPIED_FEEDBACK_MS = 1500;
const SETTLE_OPTIONS = SETTLE_PROFILES.map((profile) => ({ value: profile.id, label: profile.label }));
function statusIcon(result: LanguageTestResult): {
    icon: LucideIcon;
    className: string;
} {
    switch (result.status) {
        case 'passed':
            return { icon: CircleCheck, className: 'text-axis-y' };
        case 'issues':
            return result.errors > 0 ? { icon: CircleAlert, className: 'text-destructive' } : { icon: TriangleAlert, className: 'text-warning' };
        case 'interrupted':
            return { icon: RotateCcw, className: 'text-destructive' };
        case 'cancelled':
            return { icon: Ban, className: 'text-muted-foreground' };
        default:
            return { icon: CircleX, className: 'text-destructive' };
    }
}
function describeReloads(reloads: number): string {
    return `retomado depois de a aba recarregar ${reloads === 1 ? '1 vez' : `${reloads} vezes`}`;
}
function useCopy() {
    const [copied, setCopied] = useState<string | null>(null);
    useEffect(() => {
        if (copied === null)
            return;
        const timer = window.setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);
    const copy = async (key: string, text: string) => {
        if (await copyTextToClipboard(text))
            setCopied(key);
    };
    return { copied, copy };
}
function ResultRow({ result, copied, onCopy }: {
    result: LanguageTestResult;
    copied: boolean;
    onCopy(): void;
}) {
    const { icon: Icon, className } = statusIcon(result);
    return (<li className="flex h-8 items-center gap-2 px-2 font-mono text-2xs hover:bg-highlight">
      <Icon className={cn('size-3.5 shrink-0', className)} aria-hidden/>
      <LanguageTag language={result.target.language} size="xs" silent/>
      <span className="min-w-0 flex-1 truncate text-foreground" title={result.label}>
        {result.label}
      </span>
      <span className={cn('shrink-0 truncate text-3xs', result.errors > 0 ? 'text-destructive' : result.warnings > 0 ? 'text-warning' : 'text-muted-foreground')}>{describeResult(result)}</span>
      <IconButton label={copied ? 'Copiado' : `Copiar os avisos e erros de ${result.label}`} size="sm" onClick={onCopy} className={cn(copied && 'text-axis-y')}>
        {copied ? <Check /> : <Copy />}
      </IconButton>
    </li>);
}
export function BatchSection({ debug }: {
    debug: DebugModeController;
}) {
    const { batch } = debug;
    const { copied, copy } = useCopy();
    const languages = testableLanguages();
    const passes = languages.length + 1;
    const running = batch.isRunning;
    const summary = summarizeResults(batch.results);
    const progress = batch.progress;
    const fraction = progress ? (progress.index - 1) / progress.total : batch.state === 'done' || batch.state === 'cancelled' ? 1 : 0;
    return (<DebugSection title="Testar todas as linguagens" description="Repete o ciclo manual em cada linguagem com jogo de teste: instala, compila, inicia o playtest, deixa o jogo percorrer a API e para. Erros que só aparecem jogando entram também. No fim, cada linguagem vira uma entrada do console com os avisos e erros nos detalhes, e o relatório inteiro vai na última entrada e no botão Copiar relatório. Se a aba recarregar no meio, o lote continua de onde parou ao reabrir o projeto.">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (<ActionButton icon={Square} variant="danger" onClick={() => batch.cancel()} className="h-7">
            Cancelar
          </ActionButton>) : (<ActionButton icon={Play} variant="primary" disabled={debug.isBusy || languages.length === 0} onClick={() => debug.runAll()} className="h-7 flex-none">
            Testar todas ({passes} passadas)
          </ActionButton>)}
        <label className={cn('flex min-w-0 flex-1 items-center gap-2 text-3xs text-muted-foreground', running && 'pointer-events-none opacity-50')} title="Quanto tempo o jogo fica rodando em cada linguagem antes de parar. Depois do mínimo, o lote espera o console sossegar.">
          <span className="shrink-0">Jogo por linguagem</span>
          <SegmentedControl<SettleProfileId> label="Tempo de jogo por linguagem" options={SETTLE_OPTIONS} value={batch.settle} onChange={(value) => batch.setSettle(value)}/>
        </label>
        <ActionButton icon={copied === 'report' ? Check : ClipboardCopy} disabled={!batch.report} onClick={() => batch.report && void copy('report', batch.report)} className={cn('h-7', copied === 'report' && 'text-axis-y')}>
          {copied === 'report' ? 'Relatório copiado' : 'Copiar relatório'}
        </ActionButton>
      </div>

      {(running || batch.results.length > 0) && (<div className="flex flex-col gap-1.5 rounded-sm border border-border bg-surface-sunken/60 shadow-well">
          <div className="flex items-center gap-2 px-2 pt-2 font-mono text-3xs text-muted-foreground" role="status" aria-live="polite">
            {running ? <LoaderCircle className="size-3 shrink-0 animate-spin text-primary" aria-hidden/> : <Check className="size-3 shrink-0 text-primary" aria-hidden/>}
            <span className="min-w-0 flex-1 truncate text-foreground">
              {progress ? `${progress.index}/${progress.total} · ${progress.label} · ${BATCH_STEP_LABEL[progress.step]}…` : running ? 'Retomando o lote assim que o viewport estiver pronto…' : `${batch.state === 'cancelled' ? 'Cancelado' : 'Concluído'}: ${describeSummary(summary)}`}
            </span>
            {batch.reloads > 0 && (<span className="flex shrink-0 items-center gap-1 text-warning" title={describeReloads(batch.reloads)}>
                <RotateCcw className="size-3" aria-hidden/>
                {batch.reloads}
                <span className="sr-only">{describeReloads(batch.reloads)}</span>
              </span>)}
          </div>
          <div className="mx-2 h-1 overflow-hidden rounded-full bg-surface-overlay" aria-hidden>
            <div className={cn('h-full rounded-full transition-[width] duration-300', summary.errors > 0 || hasBrokenPasses(summary) ? 'bg-destructive' : summary.warnings > 0 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.round(fraction * 100)}%` }}/>
          </div>
          {batch.results.length > 0 && (<ul className="max-h-56 overflow-y-auto border-t border-border py-1">
              {batch.results.map((result) => (<ResultRow key={`${result.target.language}-${result.target.shaders}`} result={result} copied={copied === result.label} onCopy={() => void copy(result.label, formatLanguageReport(result))}/>))}
            </ul>)}
        </div>)}
    </DebugSection>);
}
