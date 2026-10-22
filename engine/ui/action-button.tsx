'use client';
import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
type ActionButtonProps = ComponentProps<'button'> & {
    icon?: LucideIcon;
    variant?: 'primary' | 'secondary' | 'danger';
};
const VARIANT_CLASS: Record<NonNullable<ActionButtonProps['variant']>, string> = {
    primary: 'flex-1 border-dashed border-border-strong text-foreground hover:border-primary/60 hover:bg-highlight [&_svg]:text-primary',
    secondary: 'border-border text-muted-foreground hover:bg-highlight hover:text-foreground',
    danger: 'border-border text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive',
};
export function ActionButton({ icon: Icon, variant = 'secondary', className, children, ...props }: ActionButtonProps) {
    return (<button type="button" className={cn('flex h-7 items-center justify-center gap-1.5 rounded-sm border px-2.5 text-2xs font-medium transition-colors', 'focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', 'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0', VARIANT_CLASS[variant], className)} {...props}>
      {Icon && <Icon aria-hidden/>}
      {children}
    </button>);
}
export function ActionRow({ children }: {
    children: React.ReactNode;
}) {
    return <div className="flex gap-1.5 px-2 py-1">{children}</div>;
}
