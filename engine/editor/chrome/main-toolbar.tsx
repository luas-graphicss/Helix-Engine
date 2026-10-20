'use client';
import { Undo2, Redo2, MousePointer2, Move3d, Rotate3d, Scale3d, Magnet, Globe, Box, Plus, ChevronDown, Mountain } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import type { TransformTool } from '@/engine/editor/session/editor-session';
import { AddEntityMenu } from '@/engine/editor/menus/add-entity-menu';
import { PlaytestControls } from '@/engine/editor/playtest/playtest-controls';
import { SnapSettingsMenu } from './snap-settings-menu';
const TOOLS: Array<{
    id: TransformTool;
    label: string;
    icon: LucideIcon;
}> = [
    { id: 'select', label: 'Selecionar (Q)', icon: MousePointer2 },
    { id: 'translate', label: 'Mover (W)', icon: Move3d },
    { id: 'rotate', label: 'Rotacionar (E)', icon: Rotate3d },
    { id: 'scale', label: 'Escalar (R)', icon: Scale3d },
    { id: 'terrain', label: 'Terreno (T)', icon: Mountain },
];
export function MainToolbar() {
    const session = useEditorState();
    const { history } = session;
    return (<div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-surface px-2">
      <IconButton label={history.undoLabel ? `Desfazer: ${history.undoLabel} (Ctrl+Z)` : 'Desfazer (Ctrl+Z)'} disabled={!history.canUndo} onClick={() => history.undo()}>
        <Undo2 />
      </IconButton>
      <IconButton label={history.redoLabel ? `Refazer: ${history.redoLabel} (Ctrl+Shift+Z)` : 'Refazer (Ctrl+Shift+Z)'} disabled={!history.canRedo} onClick={() => history.redo()}>
        <Redo2 />
      </IconButton>

      <ToolbarSeparator />

      <AddEntityMenu trigger={<button type="button" className="flex h-7 items-center gap-1.5 rounded-sm px-2 text-2xs font-medium text-foreground transition-colors hover:bg-highlight data-[popup-open]:bg-highlight"/>}>
        <Plus className="size-4 text-primary" aria-hidden/>
        <span>Adicionar</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
      </AddEntityMenu>

      <ToolbarSeparator />

      <div className="flex items-center gap-0.5 rounded-sm bg-surface-sunken p-0.5" role="radiogroup" aria-label="Ferramenta de transformação">
        {TOOLS.map(({ id, label, icon: Icon }) => (<IconButton key={id} label={label} active={session.tool === id} onClick={() => session.setTool(id)}>
            <Icon />
          </IconButton>))}
      </div>

      <IconButton label={session.space === 'global' ? 'Espaço global (clique para local)' : 'Espaço local (clique para global)'} active={session.space === 'local'} onClick={() => session.toggleSpace()}>
        {session.space === 'global' ? <Globe /> : <Box />}
      </IconButton>
      <IconButton label="Alinhar à grade (segure Ctrl para inverter)" active={session.snap.enabled} onClick={() => session.toggleSnap()}>
        <Magnet />
      </IconButton>
      <SnapSettingsMenu />

      <div className="flex flex-1 justify-center">
        <PlaytestControls />
      </div>

      <span className="font-mono text-[10px] text-muted-foreground">
        {session.countEntities()} atores · {session.stats.triangles.toLocaleString('pt-BR')} tris
      </span>
    </div>);
}
