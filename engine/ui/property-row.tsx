import type { ReactNode } from 'react';
type PropertyRowProps = {
    label: string;
    children: ReactNode;
};
export function PropertyRow({ label, children }: PropertyRowProps) {
    return (<div className="grid min-h-7 grid-cols-[88px_minmax(0,1fr)] items-center gap-2 px-2">
      <span className="truncate text-2xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>);
}
