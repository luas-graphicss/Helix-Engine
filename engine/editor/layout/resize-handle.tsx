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
    return (<div role="separator" aria-label={label} aria-orientation={isHorizontal ? 'vertical' : 'horizontal'} className={cn('group relative z-10 shrink-0 bg-border transition-colors delay-100 duration-150 select-none hover:bg-primary', isHorizontal ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize', active && 'bg-primary delay-0', className)} {...props}>
      <span aria-hidden className={cn('absolute', isHorizontal ? 'inset-y-0 -left-[3px] w-[7px]' : 'inset-x-0 -top-[3px] h-[7px]')}/>
    </div>);
}
