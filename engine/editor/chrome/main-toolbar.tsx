'use client';
import { Undo2, Redo2, Plus, ChevronDown, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { FOCUS_RING_CLASS, RAISED_CLASS } from '@/engine/ui/surface-styles';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { AddEntityMenu } from '@/engine/editor/menus/add-entity-menu';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { NetStatusChip } from '@/engine/editor/playtest/net-status-chip';
import { PlaytestControls } from '@/engine/editor/playtest/playtest-controls';
import { PanelToggles } from '@/engine/editor/layout/panel-toggles';
import { DebugModeButton } from '@/engine/debug/ui/debug-mode-button';
import { WorkspaceSwitch } from './workspace-switch';
const TOOLBAR_BUTTON_CLASS = cn('flex h-6 items-center gap-1.5 rounded-sm px-2 text-2xs font-medium text-foreground transition-[filter] duration-100', RAISED_CLASS, 'hover:brightness-115 active:brightness-90 data-[popup-open]:brightness-115', FOCUS_RING_CLASS);
function SceneTools() {
    const session = useSessionTopic('view', 'workspace', 'scene');
    const hint = useShortcutHint();
    return (<>
      <AddEntityMenu trigger={<button type="button" className={TOOLBAR_BUTTON_CLASS}/>}>
        <Plus className="size-4 text-primary" aria-hidden/>
        <span>Adicionar</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
      </AddEntityMenu>

      <ToolbarSeparator />

      <button type="button" onClick={() => openMaterialEditor()} className={TOOLBAR_BUTTON_CLASS} title={hint('Editor de materiais', 'view.materialEditor')}>
        <Palette className="size-4 text-primary" aria-hidden/>
        <span>Materiais</span>
        {session.materials.size > 0 && <span className="font-mono text-3xs text-muted-foreground">{session.materials.size}</span>}
      </button>
    </>);
}
export function MainToolbar() {
    const session = useSessionTopic('view', 'workspace', 'scene');
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
