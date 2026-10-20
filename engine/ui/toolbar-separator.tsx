import { cn } from '@/lib/utils';
export function ToolbarSeparator({ className }: {
    className?: string;
}) {
    return (<span role="separator" aria-orientation="vertical" className={cn('mx-1 h-4 w-px shrink-0 bg-border-strong', className)}/>);
}
