'use client';
import type { ComponentProps, ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { FOCUS_RING_CLASS, RAISED_CLASS } from './surface-styles';
type ActionButtonProps = ComponentProps<'button'> & {
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
    variant?: 'primary' | 'secondary' | 'danger';
};
const VARIANT_CLASS: Record<NonNullable<ActionButtonProps['variant']>, string> = {
    primary: 'flex-1 text-foreground hover:border-primary/50 [&_svg]:text-primary',
    secondary: 'text-muted-foreground hover:text-foreground',
    danger: 'text-muted-foreground hover:border-destructive/50 hover:text-destructive [&_svg]:hover:text-destructive',
};
export function ActionButton({ icon: Icon, variant = 'secondary', className, children, ...props }: ActionButtonProps) {
    return (<button type="button" className={cn('flex h-6 min-w-0 items-center justify-center gap-1.5 rounded-sm px-2.5 text-2xs font-medium whitespace-nowrap transition-[color,border-color,filter] duration-100', RAISED_CLASS, 'hover:brightness-115 active:brightness-90', FOCUS_RING_CLASS, 'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0', VARIANT_CLASS[variant], className)} {...props}>
      {Icon && <Icon aria-hidden/>}
      <span className="min-w-0 truncate">{children}</span>
    </button>);
}
export function ActionRow({ children }: {
    children: React.ReactNode;
}) {
    return <div className="flex flex-wrap gap-1.5 px-2 py-1">{children}</div>;
}
