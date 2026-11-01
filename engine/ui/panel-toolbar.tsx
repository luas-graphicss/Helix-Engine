import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function PanelToolbar({ className, children, ...props }: ComponentProps<'div'>) {
    return (<div className={cn('flex h-panelbar shrink-0 items-center gap-1 border-b border-border px-1.5', className)} {...props}>
      {children}
    </div>);
}
