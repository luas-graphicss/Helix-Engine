import type { ReactNode } from 'react';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
type ColumnProps = {
    title: string;
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
};
export function Column({ title, actions, className, children }: ColumnProps) {
    return (<section className={cn('flex min-h-0 min-w-0 flex-col border-b border-border @2xl/panel:border-r @2xl/panel:border-b-0', className)}>
      <header className="flex h-row shrink-0 items-center gap-1 border-b border-border bg-surface-raised pr-1 pl-2">
        <h3 className="min-w-0 flex-1 truncate text-3xs font-semibold tracking-[0.08em] text-foreground/90 uppercase">{title}</h3>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-auto py-1">{children}</div>
    </section>);
}
export function ColumnNote({ children }: {
    children: ReactNode;
}) {
    return <p className={cn('mx-2 my-1 px-3 py-3 text-center text-2xs text-pretty', EMPTY_NOTE_CLASS)}>{children}</p>;
}
