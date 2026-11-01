'use client';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
type SectionHeaderProps = {
    title: string;
    hint?: string;
    open: boolean;
    onToggle: () => void;
    trailing?: ReactNode;
};
export function SectionHeader({ title, hint, open, onToggle, trailing }: SectionHeaderProps) {
    return (<div className="flex h-row items-center border-b border-border bg-surface-raised bg-linear-to-b from-bevel to-transparent pr-1 pl-1 shadow-[inset_0_1px_0_0_var(--bevel),0_-1px_0_0_var(--border)]">
      <button type="button" onClick={onToggle} aria-expanded={open} title={hint} className="flex h-full min-w-0 flex-1 items-center gap-1 text-left text-3xs font-semibold tracking-[0.08em] text-foreground/90 uppercase transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary">
        <ChevronDown aria-hidden className={cn('size-3 text-muted-foreground transition-transform duration-150', !open && '-rotate-90')}/>
        <span className="truncate" title={hint ? undefined : title}>
          {title}
        </span>
      </button>
      {trailing && <div className="flex shrink-0 items-center gap-0.5">{trailing}</div>}
    </div>);
}
