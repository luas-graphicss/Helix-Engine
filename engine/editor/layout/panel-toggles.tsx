'use client';
import { Maximize2, Minimize2 } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { useDockLayout } from './dock-layout-context';
import { TOOLBAR_PANELS } from './dock-panels';
export function PanelToggles() {
    const [layout, dock] = useDockLayout();
    return (<div className="flex items-center gap-0.5" role="group" aria-label="Painéis">
      {TOOLBAR_PANELS.map((panel) => {
            const Icon = panel.icon;
            const open = dock.isOpen(panel.id);
            return (<IconButton key={panel.id} label={`${open ? 'Fechar' : 'Abrir'} ${panel.label}${panel.shortcut ? ` (${panel.shortcut})` : ''}`} active={open} onClick={() => dock.toggle(panel.id)}>
            <Icon />
          </IconButton>);
        })}
      <IconButton label={layout.maximized ? 'Restaurar painéis (Ctrl+Shift+Espaço)' : 'Maximizar viewport (Ctrl+Shift+Espaço)'} active={layout.maximized} onClick={() => dock.toggleMaximized()}>
        {layout.maximized ? <Minimize2 /> : <Maximize2 />}
      </IconButton>
    </div>);
}
