import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { WELL_CLASS } from './surface-styles';
type FieldInputProps = ComponentProps<'input'> & {
    axis?: 'x' | 'y' | 'z';
};
const axisColorClass = {
    x: 'bg-axis-x',
    y: 'bg-axis-y',
    z: 'bg-axis-z',
} as const;
export function FieldInput({ axis, className, ...props }: FieldInputProps) {
    return (<div className={cn('flex h-control min-w-0 flex-1 items-center overflow-hidden rounded-sm transition-colors duration-100', WELL_CLASS, 'hover:border-border-strong focus-within:border-primary/80 focus-within:hover:border-primary/80 has-[:disabled]:opacity-50', className)}>
      {axis && <span aria-hidden className={cn('h-full w-[3px] shrink-0', axisColorClass[axis])}/>}
      <input {...props} className="h-full w-full min-w-0 bg-transparent px-1.5 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 read-only:text-muted-foreground"/>
    </div>);
}
