import { cn } from '@/lib/utils';
export function ToolbarSeparator({ className }: {
    className?: string;
}) {
    return <span role="separator" aria-orientation="vertical" className={cn('mx-1.5 h-4 w-px shrink-0 bg-border shadow-[1px_0_0_0_var(--bevel)]', className)}/>;
}
