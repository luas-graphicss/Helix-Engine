import type { ReactNode } from 'react';
type PropertyRowProps = {
    label: string;
    hint?: string;
    children: ReactNode;
};
export function PropertyRow({ label, hint, children }: PropertyRowProps) {
    return (<div className="grid min-h-row grid-cols-[88px_minmax(0,1fr)] items-center gap-2 px-2">
      <span className="truncate text-2xs text-muted-foreground" title={hint ?? label}>
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>);
}
