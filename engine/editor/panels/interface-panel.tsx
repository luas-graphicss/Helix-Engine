'use client';
import { useState } from 'react';
import { LayoutTemplate, Shapes, Sparkles, Type } from 'lucide-react';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { TabStrip, type TabDefinition } from '@/engine/ui/tab-strip';
import { ActionButton } from '@/engine/ui/action-button';
import { ElementPalette } from './interface/element-palette';
import { FontsPalette } from './interface/fonts-palette';
import { IconPalette } from './interface/icon-palette';
import { ScreensPalette } from './interface/screens-palette';
type PaletteTab = 'elements' | 'icons' | 'screens' | 'fonts';
const TABS: ReadonlyArray<TabDefinition & {
    id: PaletteTab;
}> = [
    { id: 'elements', label: 'Elementos', icon: Shapes },
    { id: 'icons', label: 'Ícones', icon: Sparkles },
    { id: 'screens', label: 'Telas', icon: LayoutTemplate },
    { id: 'fonts', label: 'Fontes', icon: Type },
];
export function InterfacePanel() {
    const session = useSessionTopic('workspace', 'assets', 'scene');
    const designer = useGuiDesigner();
    const [tab, setTab] = useState<PaletteTab>('elements');
    const designing = session.workspace === 'gui';
    const hasContext = designer.document !== null || !designing;
    return (<div className="flex h-full min-h-0 flex-col">
      
      <div className="flex min-h-7 shrink-0 flex-wrap items-stretch border-b border-border bg-surface-sunken">
        <TabStrip tabs={[...TABS]} activeId={tab} onChange={(id) => setTab(id as PaletteTab)} className="h-7 max-w-full"/>
        
        {hasContext && (<div className="ml-auto flex h-7 min-w-0 items-center gap-2 px-2">
            {designer.document && (<span className="min-w-0 truncate font-mono text-3xs text-muted-foreground" title={designer.document.name}>
                {designer.document.name}
              </span>)}
            {!designing && (<ActionButton onClick={() => session.setWorkspace('gui')} className="h-5 shrink-0">
                Abrir área de trabalho Interface
              </ActionButton>)}
          </div>)}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'elements' && <ElementPalette />}
        {tab === 'icons' && <IconPalette />}
        {tab === 'screens' && <ScreensPalette />}
        {tab === 'fonts' && <FontsPalette />}
      </div>
    </div>);
}
