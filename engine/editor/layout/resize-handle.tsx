'use client';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import type { ResizeAxis } from './use-resizable-size';
type ResizeHandleProps = ComponentProps<'div'> & {
    axis: ResizeAxis;
    active: boolean;
    label: string;
};
export function ResizeHandle({ axis, active, label, className, ...props }: ResizeHandleProps) {
    const isHorizontal = axis === 'horizontal';
    return (<div role="separator" aria-label={label} aria-orientation={isHorizontal ? 'vertical' : 'horizontal'} className={cn('group relative z-10 shrink-0 bg-border select-none', isHorizontal ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize', className)} {...props}>
      <span aria-hidden className={cn('absolute transition-colors', isHorizontal ? 'inset-y-0 -left-1 w-[7px]' : 'inset-x-0 -top-1 h-[7px]', 'group-hover:bg-primary/40', active && 'bg-primary/60')}/>
    </div>);
}
