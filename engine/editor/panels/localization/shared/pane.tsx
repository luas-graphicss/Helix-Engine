import type { ReactNode } from 'react';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
type PaneProps = {
    title: string;
    className?: string;
    children: ReactNode;
};
export function Pane({ title, className, children }: PaneProps) {
    return (<section className={cn('flex min-h-0 min-w-0 flex-col', className)}>
      <header className="flex h-row shrink-0 items-center border-b border-border bg-surface-raised px-2">
        <h3 className="min-w-0 flex-1 truncate text-3xs font-semibold tracking-[0.08em] text-foreground/90 uppercase">{title}</h3>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>);
}
export function PaneNote({ children }: {
    children: ReactNode;
}) {
    return <p className={cn('mx-2 my-2 px-3 py-3 text-center text-2xs text-pretty', EMPTY_NOTE_CLASS)}>{children}</p>;
}
