'use client';
import type { DragEvent, KeyboardEvent } from 'react';
import { X, type LucideIcon } from 'lucide-react';
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
    onClose?: (id: string) => void;
    onDragTab?: (id: string | null, event: DragEvent<HTMLElement>) => void;
};
export function TabStrip({ tabs, activeId, onChange, className, compact = false, onClose, onDragTab }: TabStripProps) {
    const onKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onChange(id);
        }
        else if ((event.key === 'Delete' || event.key === 'Backspace') && onClose) {
            event.preventDefault();
            onClose(id);
        }
    };
    return (<div role="tablist" className={cn('flex h-full min-w-0 items-end overflow-hidden', className)}>
      {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            const Icon = tab.icon;
            const iconOnly = compact && !isActive && Icon !== undefined;
            return (<div key={tab.id} role="tab" tabIndex={isActive ? 0 : -1} aria-selected={isActive} aria-label={iconOnly ? tab.label : undefined} title={iconOnly ? tab.label : undefined} draggable={onDragTab !== undefined} onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    onDragTab?.(tab.id, event);
                }} onDragEnd={(event) => onDragTab?.(null, event)} onClick={() => onChange(tab.id)} onAuxClick={(event) => {
                    if (event.button === 1 && onClose)
                        onClose(tab.id);
                }} onKeyDown={(event) => onKeyDown(event, tab.id)} className={cn('group/tab relative flex h-full min-w-0 cursor-default items-center gap-1.5 border-r border-border text-2xs font-medium whitespace-nowrap transition-colors select-none', iconOnly ? 'px-2.5' : onClose ? 'pr-1 pl-3' : 'px-3', 'focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', isActive ? 'bg-surface text-foreground' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            {Icon && <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden/>}
            {!iconOnly && <span className="truncate">{tab.label}</span>}
            {tab.badge && (<span className={cn('shrink-0 rounded-full px-1.5 py-px font-mono text-[10px] leading-none tabular-nums', tab.badge.tone === 'warning' ? 'bg-warning/20 text-warning' : 'bg-surface-raised text-muted-foreground ring-1 ring-inset ring-border')}>
                {tab.badge.label}
              </span>)}
            {onClose && !iconOnly && (<button type="button" aria-label={`Fechar ${tab.label}`} title="Fechar painel" tabIndex={-1} onClick={(event) => {
                        event.stopPropagation();
                        onClose(tab.id);
                    }} className={cn('ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-opacity hover:bg-surface-raised hover:text-foreground', isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover/tab:opacity-70')}>
                <X className="size-3" aria-hidden/>
              </button>)}
            {isActive && <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-primary"/>}
          </div>);
        })}
    </div>);
}
