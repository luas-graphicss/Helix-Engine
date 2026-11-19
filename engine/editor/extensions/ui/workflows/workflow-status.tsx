'use client';
import { Loader, X } from 'lucide-react';
import { useWorkflowRunner } from './use-workflow-runner';
const PERCENT = 100;
export function WorkflowStatus() {
    const runner = useWorkflowRunner();
    const { progress } = runner;
    if (!progress)
        return null;
    const percent = Math.round(progress.fraction * PERCENT);
    const step = progress.stepCount > 1 ? ` · ${progress.stepIndex + 1}/${progress.stepCount}` : '';
    const summary = progress.cancelling ? `Cancelando ${progress.title}…` : `${progress.title}${step} · ${progress.message ?? progress.stepTitle}`;
    return (<span role="status" className="flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap text-foreground" title={summary}>
      <Loader className="size-3 shrink-0 animate-spin text-primary [animation-duration:1.6s]" aria-hidden/>
      <span className="max-w-56 truncate">{summary}</span>
      <span role="progressbar" aria-label={`Progresso de ${progress.title}`} aria-valuemin={0} aria-valuemax={PERCENT} aria-valuenow={percent} className="h-1 w-16 overflow-hidden rounded-full bg-border">
        <span className="block h-full bg-primary transition-[width] duration-150" style={{ width: `${percent}%` }}/>
      </span>
      <span className="w-7 text-right tabular-nums">{percent}%</span>
      <button type="button" aria-label={`Cancelar ${progress.title}`} title="Cancelar" disabled={progress.cancelling} onClick={() => runner.cancel(progress.workflowId)} className="flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground disabled:pointer-events-none disabled:opacity-50">
        <X className="size-3" aria-hidden/>
      </button>
    </span>);
}
