'use client';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
export function Section({ title, description, children, dimmed = false }: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
    dimmed?: boolean;
}) {
    return (<section className={cn('flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0', dimmed && 'opacity-60')}>
      <header className="flex flex-col gap-0.5">
        <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
        {description && <p className="text-2xs leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>);
}
export function Row({ label, hint, children }: {
    label: string;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (<div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3">
      <div className="flex flex-col gap-0.5 pt-1">
        <span className="text-2xs text-foreground">{label}</span>
        {hint && <span className="text-3xs leading-relaxed text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>);
}
export interface FactItem {
    readonly label: string;
    readonly value: ReactNode;
    readonly detail?: ReactNode;
    readonly tone?: 'default' | 'warn';
}
export function FactGrid({ facts, columns = 3 }: {
    facts: readonly FactItem[];
    columns?: 2 | 3 | 4;
}) {
    return (<dl className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', columns === 4 && 'sm:grid-cols-2 md:grid-cols-4')}>
      {facts.map((fact) => (<div key={fact.label} className={cn('flex min-w-0 flex-col gap-0.5 rounded-sm border border-border bg-surface-sunken/60 px-3 py-2', fact.tone === 'warn' && 'border-warning/40')}>
          <dt className="text-3xs tracking-wider text-muted-foreground uppercase">{fact.label}</dt>
          <dd className={cn('truncate text-2xs text-foreground', fact.tone === 'warn' && 'text-warning')}>{fact.value}</dd>
          {fact.detail && <dd className="text-3xs leading-relaxed text-pretty text-muted-foreground">{fact.detail}</dd>}
        </div>))}
    </dl>);
}
