'use client';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
type IconButtonProps = ComponentProps<'button'> & {
    label: string;
    active?: boolean;
    size?: 'sm' | 'md';
};
export function IconButton({ label, active = false, size = 'md', className, children, ...props }: IconButtonProps) {
    return (<button type="button" aria-label={label} title={label} aria-pressed={active} className={cn('inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors', 'hover:bg-highlight hover:text-foreground', 'focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', 'disabled:pointer-events-none disabled:opacity-40', size === 'sm' ? 'size-6 [&_svg]:size-3.5' : 'size-7 [&_svg]:size-4', active && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary', className)} {...props}>
      {children}
    </button>);
}
