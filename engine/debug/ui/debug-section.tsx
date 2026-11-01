import type { ReactNode } from 'react';
export function DebugSection({ title, description, children }: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (<section className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
        <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>);
}
