import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SOURCE_STATUS_LABEL, type SourceStatus } from '@/engine/audio/world/audio-world';
export type StatusTone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';
const TONE_CLASS: Record<StatusTone, string> = {
    ok: 'border-axis-y/50 text-axis-y',
    info: 'border-primary/50 text-primary',
    warn: 'border-warning/60 text-warning',
    danger: 'border-destructive/60 text-destructive',
    muted: 'border-border text-muted-foreground',
};
export const SOURCE_STATUS_TONE: Record<SourceStatus, StatusTone> = {
    playing: 'ok',
    virtual: 'muted',
    loading: 'info',
    waiting: 'info',
    stopped: 'muted',
    muted: 'muted',
    'solo-muted': 'muted',
    'no-asset': 'warn',
    off: 'muted',
    locked: 'warn',
    error: 'danger',
};
export const SOURCE_STATUS_HINT: Partial<Record<SourceStatus, string>> = {
    virtual: 'Longe demais ou sem voz livre: sem custo de CPU; volta a tocar ao entrar no alcance.',
    locked: 'O navegador só libera o som depois de um gesto: clique ou tecle em qualquer lugar.',
    'no-asset': 'Escolha um áudio da biblioteca para esta fonte, ou gere um som de teste.',
    off: 'A audição do editor está desligada; o botão Tocar e o jogo continuam valendo.',
    'solo-muted': 'Outra fonte está em solo.',
};
export function StatusChip({ tone, children, className }: {
    tone: StatusTone;
    children: ReactNode;
    className?: string;
}) {
    return <span className={cn('inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-3xs tracking-wide whitespace-nowrap', TONE_CLASS[tone], className)}>{children}</span>;
}
export function SourceStatusChip({ status, className }: {
    status: SourceStatus;
    className?: string;
}) {
    return (<StatusChip tone={SOURCE_STATUS_TONE[status]} className={className}>
      {SOURCE_STATUS_LABEL[status]}
    </StatusChip>);
}
