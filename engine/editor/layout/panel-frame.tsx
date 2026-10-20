'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { TabStrip, type TabDefinition } from '@/engine/ui/tab-strip';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
const COMPACT_TAB_COUNT = 3;
type PanelFrameProps = {
    tabs: TabDefinition[];
    defaultTabId?: string;
    renderTab: (tabId: string) => ReactNode;
    className?: string;
};
export function PanelFrame({ tabs, defaultTabId, renderTab, className }: PanelFrameProps) {
    const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id ?? '');
    return (<section className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-surface', className)}>
      <header className="flex h-7 shrink-0 items-stretch border-b border-border bg-surface-sunken">
        <TabStrip tabs={tabs} activeId={activeId} onChange={setActiveId} className="flex-1" compact={tabs.length > COMPACT_TAB_COUNT}/>
        <div className="flex items-center px-0.5">
          <IconButton label="Opções do painel" size="sm">
            <Ellipsis />
          </IconButton>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{renderTab(activeId)}</div>
    </section>);
}
