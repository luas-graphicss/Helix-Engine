import type { ReactNode } from 'react';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
type PanelSectionProps = {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    dimmed?: boolean;
    children: ReactNode;
};
export function ViewGrid({ children }: {
    children: ReactNode;
}) {
    return <div className="grid h-full min-h-0 auto-rows-min grid-cols-1 overflow-auto @2xl/panel:grid-cols-2 @5xl/panel:grid-cols-3">{children}</div>;
}
export function PanelSection({ title, description, actions, dimmed = false, children }: PanelSectionProps) {
    return (<section className={cn('flex min-w-0 flex-col gap-2 border-b border-border px-3 py-3 @2xl/panel:border-r', dimmed && 'opacity-60')}>
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-3xs font-semibold tracking-[0.08em] text-foreground/90 uppercase">{title}</h3>
          {description && <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {children}
    </section>);
}
export function SettingRow({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-2xs text-foreground">{label}</span>
        {hint && <span className="text-3xs leading-snug text-pretty text-muted-foreground">{hint}</span>}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">{children}</div>
    </div>);
}
export function SectionNote({ children }: {
    children: ReactNode;
}) {
    return <p className={cn('px-3 py-2 text-2xs leading-relaxed text-pretty', EMPTY_NOTE_CLASS)}>{children}</p>;
}
