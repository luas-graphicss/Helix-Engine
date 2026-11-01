import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
export function PaletteNotice({ children }: {
    children: ReactNode;
}) {
    return (<div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-2xs text-muted-foreground">
      <Info className="size-3.5 shrink-0 text-primary" aria-hidden/>
      <span className="text-pretty">{children}</span>
    </div>);
}
