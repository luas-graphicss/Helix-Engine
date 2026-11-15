'use client';
import { useState } from 'react';
import { Check, ChevronRight, Circle, ListChecks, LoaderCircle, X, type LucideIcon } from 'lucide-react';
import type { PlanStep, PlanStepStatus } from '@/engine/editor/assistant/conversation/conversation-entry';
import { IconButton } from '@/engine/ui/icon-button';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
interface StatusMeta {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly iconClass: string;
    readonly titleClass: string;
}
const STATUS_META: Record<PlanStepStatus, StatusMeta> = {
    pending: { label: 'Pendente', icon: Circle, iconClass: 'text-muted-foreground/60', titleClass: 'text-muted-foreground' },
    in_progress: { label: 'Em andamento', icon: LoaderCircle, iconClass: 'text-primary motion-safe:animate-spin', titleClass: 'text-foreground' },
    completed: { label: 'Concluído', icon: Check, iconClass: 'text-success', titleClass: 'text-muted-foreground' },
};
type PlanPanelProps = {
    steps: readonly PlanStep[];
    onDismiss: () => void;
};
function PlanStepRow({ step }: {
    step: PlanStep;
}) {
    const meta = STATUS_META[step.status];
    const Icon = meta.icon;
    return (<li className="flex items-start gap-1.5 text-2xs">
      <Icon aria-hidden className={cn('mt-0.5 size-3 shrink-0', meta.iconClass)}/>
      <span className={cn('min-w-0 break-words', meta.titleClass)}>{step.title}</span>
      <span className="sr-only">{meta.label}</span>
    </li>);
}
export function PlanPanel({ steps, onDismiss }: PlanPanelProps) {
    const [open, setOpen] = useState(true);
    const completed = steps.filter((step) => step.status === 'completed').length;
    const current = steps.find((step) => step.status === 'in_progress');
    return (<section aria-label="Plano do assistente" className="flex max-h-[40%] shrink-0 flex-col border-t border-border bg-surface-sunken/40">
      <div className="flex shrink-0 items-center gap-1 pr-1">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={cn('flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left transition-colors duration-100 hover:bg-highlight', FOCUS_RING_CLASS)}>
          <ListChecks aria-hidden className="size-3.5 shrink-0 text-muted-foreground"/>
          <span className="shrink-0 text-2xs font-medium text-foreground">Plano</span>
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{open ? null : current?.title}</span>
          <span aria-hidden className="shrink-0 font-mono text-3xs text-muted-foreground">
            {completed}/{steps.length}
          </span>
          <span className="sr-only">
            {completed} de {steps.length} etapas concluídas
          </span>
          <ChevronRight aria-hidden className={cn('size-3 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-90')}/>
        </button>
        <IconButton label="Fechar plano" size="xs" onClick={onDismiss}>
          <X />
        </IconButton>
      </div>
      {open && (<ol className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-1.5">
          {steps.map((step, index) => (<PlanStepRow key={`${index}-${step.title}`} step={step}/>))}
        </ol>)}
    </section>);
}
