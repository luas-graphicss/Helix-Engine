import type { ReactNode } from 'react';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const INDENT_CLASS = ['pl-2', 'pl-6', 'pl-10'] as const;
type ListRowProps = {
    selected: boolean;
    title: string;
    onSelect: () => void;
    children: ReactNode;
    actions?: ReactNode;
    indent?: 0 | 1 | 2;
};
export function ListRow({ selected, title, onSelect, children, actions, indent = 0 }: ListRowProps) {
    return (<div className={cn('group flex items-center text-2xs', selected ? 'bg-primary/20 text-foreground' : 'text-foreground/90 hover:bg-highlight')}>
      <button type="button" aria-pressed={selected} title={title} onClick={onSelect} className={cn('flex h-control min-w-0 flex-1 cursor-default items-center gap-1.5 pr-2 text-left select-none', INDENT_CLASS[indent], FOCUS_RING_CLASS)}>
        {children}
      </button>
      {actions && <span className="flex shrink-0 items-center pr-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">{actions}</span>}
    </div>);
}
