'use client';
import { Grid3x3, Maximize2, Minimize2, Locate, Eclipse, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useDockLayout } from '@/engine/editor/layout/dock-layout-context';
import { HUD_GROUP_CLASS } from './hud-styles';
import { TransformOptions } from './tools/transform-options';
import { ViewModeMenu } from './view-mode-menu';
export function ViewportToolbar() {
    const session = useSessionTopic('scene', 'selection', 'view');
    const [layout, dock] = useDockLayout();
    return (<div className="pointer-events-none flex w-full flex-wrap items-start gap-1.5">
      <div className={HUD_GROUP_CLASS}>
        <ViewModeMenu />
      </div>
      <TransformOptions />

      <div className={cn(HUD_GROUP_CLASS, 'ml-auto')}>
        <IconButton label="Grade (G)" size="sm" active={session.showGrid} onClick={() => session.toggleGrid()}>
          <Grid3x3 />
        </IconButton>
        <IconButton label="Sombras" size="sm" active={session.shadowsEnabled} onClick={() => session.toggleShadows()}>
          <Eclipse />
        </IconButton>
        <IconButton label="Céu físico" size="sm" active={session.scene.sky.enabled} onClick={() => session.toggleSky()}>
          <Sun />
        </IconButton>
        <IconButton label="Enquadrar a seleção (F)" size="sm" disabled={session.selectedId === null} onClick={() => session.focusSelected()}>
          <Locate />
        </IconButton>
        <IconButton label={layout.maximized ? 'Restaurar painéis (Ctrl+Shift+Espaço)' : 'Maximizar viewport (Ctrl+Shift+Espaço)'} size="sm" active={layout.maximized} onClick={() => dock.toggleMaximized()}>
          {layout.maximized ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
      </div>
    </div>);
}
