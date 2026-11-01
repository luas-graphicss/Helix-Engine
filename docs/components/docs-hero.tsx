import type { ReactNode } from 'react';
import { ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
export function DocsHero({ eyebrow, title, description, children }: {
    eyebrow: string;
    title: string;
    description: string;
    children?: ReactNode;
}) {
    return (<section className="relative overflow-hidden rounded-lg border border-border-strong bg-surface shadow-bevel">
      <div className="boot-grid absolute inset-0" aria-hidden/>
      <div className="relative flex flex-col gap-5 p-8 lg:p-12">
        <p className="font-mono text-2xs tracking-[0.2em] text-primary uppercase">
          Helix Engine {ENGINE_VERSION_LABEL} · {eyebrow}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground text-balance lg:text-5xl lg:leading-[1.08]">{title}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">{description}</p>
        {children && <div className="mt-2 flex flex-col gap-4">{children}</div>}
      </div>
    </section>);
}
