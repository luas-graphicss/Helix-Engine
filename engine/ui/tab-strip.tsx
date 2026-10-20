'use client';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
export type TabDefinition = {
    id: string;
    label: string;
    icon?: LucideIcon;
    badge?: {
        label: string;
        tone?: 'neutral' | 'warning';
    };
};
type TabStripProps = {
    tabs: TabDefinition[];
    activeId: string;
    onChange: (id: string) => void;
    className?: string;
    compact?: boolean;
};
export function TabStrip({ tabs, activeId, onChange, className, compact = false }: TabStripProps) {
    return (<div role="tablist" className={cn('flex h-full min-w-0 items-end overflow-hidden', className)}>
      {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            const Icon = tab.icon;
            const iconOnly = compact && !isActive && Icon !== undefined;
            return (<button key={tab.id} type="button" role="tab" aria-selected={isActive} aria-label={iconOnly ? tab.label : undefined} title={iconOnly ? tab.label : undefined} onClick={() => onChange(tab.id)} className={cn('relative flex h-full min-w-0 items-center gap-1.5 border-r border-border text-2xs font-medium whitespace-nowrap transition-colors', iconOnly ? 'px-2.5' : 'px-3', 'focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', isActive
                    ? 'bg-surface text-foreground'
                    : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            {Icon && <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden/>}
            {!iconOnly && <span className="truncate">{tab.label}</span>}
            {tab.badge && (<span className={cn('shrink-0 rounded-full px-1.5 py-px font-mono text-[10px] leading-none tabular-nums', tab.badge.tone === 'warning' ? 'bg-warning/20 text-warning' : 'bg-surface-raised text-muted-foreground ring-1 ring-inset ring-border')}>
                {tab.badge.label}
              </span>)}
            {isActive && (<span aria-hidden className="absolute inset-x-0 top-0 h-px bg-primary"/>)}
          </button>);
        })}
    </div>);
}
