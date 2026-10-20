'use client';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
type SectionHeaderProps = {
    title: string;
    open: boolean;
    onToggle: () => void;
    trailing?: ReactNode;
};
export function SectionHeader({ title, open, onToggle, trailing }: SectionHeaderProps) {
    return (<div className="flex h-7 items-center border-y border-border bg-surface-raised/60 pr-1 pl-1.5">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1 text-left text-2xs font-semibold tracking-wide text-foreground uppercase">
        <ChevronDown aria-hidden className={cn('size-3.5 text-muted-foreground transition-transform', !open && '-rotate-90')}/>
        <span className="truncate">{title}</span>
      </button>
      {trailing}
    </div>);
}
