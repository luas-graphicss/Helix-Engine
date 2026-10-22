'use client';
import type { DragEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TabStrip, type TabDefinition } from '@/engine/ui/tab-strip';
import { IconButton } from '@/engine/ui/icon-button';
import { MENU_CONTENT_CLASS } from '@/engine/editor/menus/menu-styles';
import { cn } from '@/lib/utils';
const COMPACT_TAB_COUNT = 3;
type PanelFrameProps = {
    tabs: TabDefinition[];
    defaultTabId?: string;
    activeTabId?: string;
    onActiveTabChange?: (tabId: string) => void;
    renderTab: (tabId: string) => ReactNode;
    onCloseTab?: (tabId: string) => void;
    menu?: ReactNode;
    onDragTab?: (tabId: string | null, event: DragEvent<HTMLElement>) => void;
    onDropTab?: (event: DragEvent<HTMLElement>) => void;
    canDropTab?: (event: DragEvent<HTMLElement>) => boolean;
    className?: string;
};
export function PanelFrame({ tabs, defaultTabId, activeTabId, onActiveTabChange, renderTab, onCloseTab, menu, onDragTab, onDropTab, canDropTab, className }: PanelFrameProps) {
    const [internalId, setInternalId] = useState(defaultTabId ?? tabs[0]?.id ?? '');
    const [dropHover, setDropHover] = useState(false);
    const activeId = tabs.some((tab) => tab.id === activeTabId) ? (activeTabId as string) : tabs.some((tab) => tab.id === internalId) ? internalId : (tabs[0]?.id ?? '');
    const selectTab = (tabId: string) => {
        setInternalId(tabId);
        onActiveTabChange?.(tabId);
    };
    const acceptsDrop = (event: DragEvent<HTMLElement>) => Boolean(onDropTab) && (canDropTab?.(event) ?? true);
    return (<section className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-surface', className)}>
      <header className={cn('flex h-7 shrink-0 items-stretch border-b border-border bg-surface-sunken transition-colors', dropHover && 'bg-primary/15')} onDragOver={(event) => {
            if (!acceptsDrop(event))
                return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (!dropHover)
                setDropHover(true);
        }} onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setDropHover(false);
        }} onDrop={(event) => {
            setDropHover(false);
            if (!acceptsDrop(event))
                return;
            event.preventDefault();
            onDropTab?.(event);
        }}>
        <TabStrip tabs={tabs} activeId={activeId} onChange={selectTab} className="flex-1" compact={tabs.length > COMPACT_TAB_COUNT} onClose={onCloseTab} onDragTab={onDragTab}/>
        {menu && (<div className="flex items-center px-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger render={<IconButton label="Opções do painel" size="sm"/>}>
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
                {menu}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>)}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{renderTab(activeId)}</div>
    </section>);
}
