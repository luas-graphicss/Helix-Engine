'use client';
import { ChevronDown, Grid3x3, Maximize2, Camera, Eye, Locate, Eclipse, Sun } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { ViewModeMenu } from './view-mode-menu';
function DropdownChip({ label }: {
    label: string;
}) {
    return (<button type="button" className="flex h-6 items-center gap-1 rounded-sm px-2 text-2xs font-medium text-foreground/90 transition-colors hover:bg-highlight">
      <span>{label}</span>
      <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
    </button>);
}
export function ViewportToolbar() {
    const session = useEditorState();
    return (<div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-sm border border-border bg-surface-sunken/85 p-0.5 backdrop-blur-sm">
        <DropdownChip label="Perspectiva"/>
        <ViewModeMenu />
        <DropdownChip label="Exibir"/>
      </div>

      <div className="pointer-events-auto flex items-center gap-0.5 rounded-sm border border-border bg-surface-sunken/85 p-0.5 backdrop-blur-sm">
        <IconButton label="Alternar grade" size="sm" active={session.showGrid} onClick={() => session.toggleGrid()}>
          <Grid3x3 />
        </IconButton>
        <IconButton label="Alternar sombras" size="sm" active={session.shadowsEnabled} onClick={() => session.toggleShadows()}>
          <Eclipse />
        </IconButton>
        <IconButton label="Alternar céu físico" size="sm" active={session.scene.sky.enabled} onClick={() => session.toggleSky()}>
          <Sun />
        </IconButton>
        <IconButton label="Focar na seleção (F)" size="sm" disabled={session.selectedId === null} onClick={() => session.focusSelected()}>
          <Locate />
        </IconButton>
        <IconButton label="Velocidade da câmera" size="sm">
          <Camera />
        </IconButton>
        <IconButton label="Visibilidade" size="sm">
          <Eye />
        </IconButton>
        <IconButton label="Maximizar viewport" size="sm">
          <Maximize2 />
        </IconButton>
      </div>
    </div>);
}
