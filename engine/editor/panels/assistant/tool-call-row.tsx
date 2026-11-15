'use client';
import { useState } from 'react';
import { Ban, Check, ChevronRight, CircleAlert, Hand, LoaderCircle, X, type LucideIcon } from 'lucide-react';
import type { ToolCallEntry, ToolCallStatus } from '@/engine/editor/assistant/conversation/conversation-entry';
import { ActionButton } from '@/engine/ui/action-button';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
interface StatusMeta {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly className: string;
}
const STATUS_META: Record<ToolCallStatus, StatusMeta> = {
    awaiting: { label: 'Aguardando sua aprovação', icon: Hand, className: 'text-warning' },
    running: { label: 'Executando', icon: LoaderCircle, className: 'text-primary motion-safe:animate-spin' },
    done: { label: 'Concluído', icon: Check, className: 'text-success' },
    failed: { label: 'Falhou', icon: CircleAlert, className: 'text-destructive' },
    denied: { label: 'Não autorizado', icon: X, className: 'text-muted-foreground' },
    blocked: { label: 'Bloqueado pelo modo', icon: Ban, className: 'text-muted-foreground' },
};
const DETAIL_CLASS = 'max-h-48 overflow-auto font-mono text-3xs leading-relaxed whitespace-pre-wrap';
type ToolCallRowProps = {
    entry: ToolCallEntry;
    onResolve: (entryId: number, approved: boolean) => void;
};
export function ToolCallRow({ entry, onResolve }: ToolCallRowProps) {
    const [expanded, setExpanded] = useState(false);
    const meta = STATUS_META[entry.status];
    const Icon = meta.icon;
    const awaiting = entry.status === 'awaiting';
    const open = expanded || awaiting;
    return (<div className={cn('rounded-sm border bg-surface-sunken/60', awaiting ? 'border-warning/60' : 'border-border')}>
      <button type="button" aria-expanded={open} disabled={awaiting} onClick={() => setExpanded((value) => !value)} className={cn('flex w-full min-w-0 items-center gap-1.5 px-1.5 py-1 text-left transition-colors duration-100 hover:bg-highlight disabled:hover:bg-transparent', FOCUS_RING_CLASS)}>
        <Icon aria-hidden className={cn('size-3.5 shrink-0', meta.className)}/>
        <span className="shrink-0 text-2xs font-medium text-foreground">{entry.title}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-3xs text-muted-foreground">{entry.summary}</span>
        <span className="sr-only">{meta.label}</span>
        <ChevronRight aria-hidden className={cn('size-3 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-90')}/>
      </button>
      {open && (<div className="flex flex-col gap-1 border-t border-border px-1.5 py-1">
          <p className="text-3xs text-muted-foreground">{meta.label}</p>
          {entry.input && <pre className={cn(DETAIL_CLASS, 'text-foreground/90')}>{entry.input}</pre>}
          {entry.output && <pre className={cn(DETAIL_CLASS, 'border-t border-border pt-1', entry.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>{entry.output}</pre>}
        </div>)}
      {awaiting && (<div className="flex gap-1.5 border-t border-border px-1.5 py-1">
          <ActionButton variant="primary" icon={Check} onClick={() => onResolve(entry.id, true)}>
            Permitir
          </ActionButton>
          <ActionButton variant="danger" icon={X} onClick={() => onResolve(entry.id, false)}>
            Negar
          </ActionButton>
        </div>)}
    </div>);
}
