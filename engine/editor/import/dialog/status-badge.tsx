import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
type StatusTone = 'neutral' | 'primary' | 'warning';
const TONE_CLASS: Record<StatusTone, string> = {
    neutral: 'bg-surface-raised text-muted-foreground ring-border',
    primary: 'bg-primary/15 text-primary ring-primary/30',
    warning: 'bg-warning/15 text-warning ring-warning/30',
};
type StatusBadgeProps = {
    tone?: StatusTone;
    children: ReactNode;
    className?: string;
};
export function StatusBadge({ tone = 'neutral', children, className }: StatusBadgeProps) {
    return (<span className={cn('inline-flex shrink-0 items-center rounded-sm px-1.5 py-px font-mono text-[10px] leading-4 whitespace-nowrap ring-1 ring-inset', TONE_CLASS[tone], className)}>
      {children}
    </span>);
}
