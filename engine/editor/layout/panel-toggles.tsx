'use client';
import { Maximize2, Minimize2 } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useDockLayout } from './dock-layout-context';
import { panelLabel, TOOLBAR_PANELS } from './dock-panels';
export function PanelToggles() {
    const [layout, dock] = useDockLayout();
    const { workspace } = useSessionTopic('workspace');
    return (<div className="flex shrink-0 items-center gap-px" role="group" aria-label="Painéis">
      {TOOLBAR_PANELS.map((panel) => {
            const Icon = panel.icon;
            const open = dock.isOpen(panel.id);
            const label = panelLabel(panel.id, workspace);
            return (<IconButton key={panel.id} label={`${open ? 'Fechar' : 'Abrir'} ${label}${panel.shortcut ? ` (${panel.shortcut})` : ''}`} size="sm" active={open} onClick={() => dock.toggle(panel.id)}>
            <Icon />
          </IconButton>);
        })}
      <ToolbarSeparator />
      <IconButton label={layout.maximized ? 'Restaurar painéis (Ctrl+Shift+Espaço)' : 'Maximizar viewport (Ctrl+Shift+Espaço)'} size="sm" active={layout.maximized} onClick={() => dock.toggleMaximized()}>
        {layout.maximized ? <Minimize2 /> : <Maximize2 />}
      </IconButton>
    </div>);
}
