import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
type FieldInputProps = ComponentProps<'input'> & {
    axis?: 'x' | 'y' | 'z';
};
const axisColorClass = {
    x: 'bg-axis-x',
    y: 'bg-axis-y',
    z: 'bg-axis-z',
} as const;
export function FieldInput({ axis, className, ...props }: FieldInputProps) {
    return (<div className={cn('flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border bg-input', 'focus-within:border-primary/70', className)}>
      {axis && <span aria-hidden className={cn('h-full w-[3px] shrink-0', axisColorClass[axis])}/>}
      <input {...props} className="h-full w-full min-w-0 bg-transparent px-1.5 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"/>
    </div>);
}
