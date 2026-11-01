'use client';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { FOCUS_RING_CLASS } from './surface-styles';
type IconButtonProps = ComponentProps<'button'> & {
    label: string;
    active?: boolean;
    size?: 'xs' | 'sm' | 'md';
};
const SIZE_CLASS: Record<NonNullable<IconButtonProps['size']>, string> = {
    xs: 'size-5 [&_svg]:size-3',
    sm: 'size-control [&_svg]:size-3.5',
    md: 'size-6 [&_svg]:size-4',
};
export function IconButton({ label, active = false, size = 'md', className, children, ...props }: IconButtonProps) {
    return (<button type="button" aria-label={label} title={label} aria-pressed={active} className={cn('inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100', 'hover:bg-highlight hover:text-foreground active:bg-surface-sunken', FOCUS_RING_CLASS, 'disabled:pointer-events-none disabled:opacity-35', SIZE_CLASS[size], active && 'bg-primary/15 text-primary ring-1 ring-primary/35 ring-inset hover:bg-primary/20 hover:text-primary', className)} {...props}>
      {children}
    </button>);
}
