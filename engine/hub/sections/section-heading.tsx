import type { ReactNode } from 'react';
interface SectionHeadingProps {
    id: string;
    title: string;
    description?: string;
    count?: number;
    action?: ReactNode;
}
export function SectionHeading({ id, title, description, count, action }: SectionHeadingProps) {
    return (<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <h2 id={id} className="flex items-baseline gap-2 text-xs font-semibold tracking-wide text-foreground uppercase">
          {title}
          {count !== undefined && count > 0 && <span className="font-mono text-3xs font-normal tracking-normal text-muted-foreground tabular-nums">{count}</span>}
        </h2>
        {description && <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {action}
    </div>);
}
