'use client';
import { Undo2, Redo2, MousePointer2, Move3d, Rotate3d, Scale3d, Magnet, Globe, Box, Plus, ChevronDown, Mountain, Palette } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { FOCUS_RING_CLASS, RAISED_CLASS, WELL_CLASS } from '@/engine/ui/surface-styles';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { TransformTool } from '@/engine/editor/session/editor-session';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { AddEntityMenu } from '@/engine/editor/menus/add-entity-menu';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { NetStatusChip } from '@/engine/editor/playtest/net-status-chip';
import { PlaytestControls } from '@/engine/editor/playtest/playtest-controls';
import { PanelToggles } from '@/engine/editor/layout/panel-toggles';
import { DebugModeButton } from '@/engine/debug/ui/debug-mode-button';
import { SnapSettingsMenu } from './snap-settings-menu';
import { WorkspaceSwitch } from './workspace-switch';
const TOOLS: Array<{
    id: TransformTool;
    label: string;
    icon: LucideIcon;
}> = [
    { id: 'select', label: 'Selecionar', icon: MousePointer2 },
    { id: 'translate', label: 'Mover', icon: Move3d },
    { id: 'rotate', label: 'Rotacionar', icon: Rotate3d },
    { id: 'scale', label: 'Escalar', icon: Scale3d },
    { id: 'terrain', label: 'Terreno', icon: Mountain },
];
const TOOLBAR_BUTTON_CLASS = cn('flex h-6 items-center gap-1.5 rounded-sm px-2 text-2xs font-medium text-foreground transition-[filter] duration-100', RAISED_CLASS, 'hover:brightness-115 active:brightness-90 data-[popup-open]:brightness-115', FOCUS_RING_CLASS);
function SceneTools() {
    const session = useSessionTopic('tool', 'view', 'workspace', 'scene');
    const hint = useShortcutHint();
    return (<>
      <AddEntityMenu trigger={<button type="button" className={TOOLBAR_BUTTON_CLASS}/>}>
        <Plus className="size-4 text-primary" aria-hidden/>
        <span>Adicionar</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
      </AddEntityMenu>

      <ToolbarSeparator />

      <div className={cn('flex h-6 items-center gap-px rounded-sm p-px', WELL_CLASS)} role="radiogroup" aria-label="Ferramenta de transformação">
        {TOOLS.map(({ id, label, icon: Icon }) => (<IconButton key={id} label={hint(label, `tool.${id}`)} size="sm" active={session.tool === id} onClick={() => session.setTool(id)} className="[&_svg]:size-4">
            <Icon />
          </IconButton>))}
      </div>

      <IconButton label={session.space === 'global' ? 'Eixos do mundo (clique para usar os do ator)' : 'Eixos do ator (clique para usar os do mundo)'} active={session.space === 'local'} onClick={() => session.toggleSpace()}>
        {session.space === 'global' ? <Globe /> : <Box />}
      </IconButton>
      <IconButton label="Alinhar à grade (segure Ctrl para inverter)" active={session.snap.enabled} onClick={() => session.toggleSnap()}>
        <Magnet />
      </IconButton>
      <SnapSettingsMenu />

      <ToolbarSeparator />

      <button type="button" onClick={() => openMaterialEditor()} className={TOOLBAR_BUTTON_CLASS} title={hint('Editor de materiais', 'view.materialEditor')}>
        <Palette className="size-4 text-primary" aria-hidden/>
        <span>Materiais</span>
        {session.materials.size > 0 && <span className="font-mono text-3xs text-muted-foreground">{session.materials.size}</span>}
      </button>
    </>);
}
export function MainToolbar() {
    const session = useSessionTopic('tool', 'view', 'workspace', 'scene');
    const hint = useShortcutHint();
    const { history } = session;
    const designing = session.workspace === 'gui';
    return (<div className="flex h-toolbar shrink-0 items-center gap-0.5 overflow-hidden border-b border-border bg-surface bg-linear-to-b from-bevel to-transparent px-1.5 shadow-bevel">
      <IconButton label={hint(history.undoLabel ? `Desfazer: ${history.undoLabel}` : 'Desfazer', 'edit.undo')} disabled={!history.canUndo} onClick={() => history.undo()}>
        <Undo2 />
      </IconButton>
      <IconButton label={hint(history.redoLabel ? `Refazer: ${history.redoLabel}` : 'Refazer', 'edit.redo')} disabled={!history.canRedo} onClick={() => history.redo()}>
        <Redo2 />
      </IconButton>

      <ToolbarSeparator />

      <WorkspaceSwitch />

      <ToolbarSeparator />

      {!designing && <SceneTools />}

      <div className="flex min-w-2 flex-1 items-center justify-center gap-2">
        <PlaytestControls />
        <NetStatusChip />
      </div>

      
      <DebugModeButton />
      <ToolbarSeparator />

      <PanelToggles />
    </div>);
}
