import type { ReactNode } from 'react';
export type Readout = {
    label: string;
    value: ReactNode;
    hint?: string;
};
export function ReadoutList({ items }: {
    items: readonly Readout[];
}) {
    return (<dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
      {items.map(({ label, value, hint }) => (<div key={label} className="contents">
          <dt className="truncate text-2xs text-muted-foreground" title={hint ?? label}>{label}</dt>
          <dd className="text-right font-mono text-2xs text-foreground tabular-nums">{value}</dd>
        </div>))}
    </dl>);
}
