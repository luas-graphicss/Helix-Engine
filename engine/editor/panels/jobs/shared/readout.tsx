import type { ReactNode } from 'react';
export function Readout({ children }: {
    children: ReactNode;
}) {
    return <span className="truncate font-mono text-2xs text-foreground/80 tabular-nums">{children}</span>;
}
