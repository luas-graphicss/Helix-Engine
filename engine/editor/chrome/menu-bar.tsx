'use client';
import { useState, type ReactNode } from 'react';
import { Hexagon, Undo2, Redo2, Copy, ClipboardCopy, ClipboardPaste, FolderInput, Trash2, Grid3x3, Eclipse, Sun, Keyboard, Locate, Import, LibraryBig, Play, Pause, Square, StepForward, PersonStanding, Palette, Ungroup, SquareDashed, Eye, EyeOff, Focus, FolderPlus, Lock, LockOpen, } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addFolder, copySelected, deleteSelected, duplicateSelected, groupSelected, isolateEntities, pasteClipboard, showAllEntities, toggleLockSelected, toggleVisibilitySelected, ungroupSelected, unlockAllEntities, } from '@/engine/editor/operations/entity-operations';
import { setPlayerSpawnIfMissing } from '@/engine/editor/operations/player-operations';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { ShortcutsDialog } from '@/engine/editor/dialogs/shortcuts-dialog';
import { openImportFilePicker } from '@/engine/editor/import/import-file-picker';
import { pickFilesForLibrary } from '@/engine/editor/operations/asset-library-operations';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { PanelsMenuItems } from '@/engine/editor/layout/panels-menu-items';
function MenuBarMenu({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="px-2 text-2xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary data-[popup-open]:bg-highlight data-[popup-open]:text-foreground"/>}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2} className={MENU_CONTENT_CLASS}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>);
}
export function MenuBar() {
    const session = useEditorState();
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const { history, playtest } = session;
    const hasSelection = session.selectedEntity !== null;
    const playing = playtest.state === 'playing';
    return (<div className="flex h-7 shrink-0 items-center border-b border-border bg-surface-sunken pr-2 pl-2">
      <div className="mr-2 flex items-center gap-1.5 pr-2">
        <span className="flex size-4 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <Hexagon className="size-3" strokeWidth={2.5} aria-hidden/>
        </span>
        <span className="text-2xs font-semibold tracking-wide text-foreground">HELIX</span>
      </div>

      <nav aria-label="Menu principal" className="flex h-full items-stretch">
        <MenuBarMenu label="Arquivo">
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openImportFilePicker()}>
              <Import aria-hidden/>
              Importar modelo…
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+I</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => pickFilesForLibrary(session)}>
              <LibraryBig aria-hidden/>
              Adicionar à biblioteca…
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+B</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </MenuBarMenu>

        <MenuBarMenu label="Editar">
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!history.canUndo} onClick={() => history.undo()}>
              <Undo2 aria-hidden/>
              {history.undoLabel ? `Desfazer ${history.undoLabel}` : 'Desfazer'}
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!history.canRedo} onClick={() => history.redo()}>
              <Redo2 aria-hidden/>
              {history.redoLabel ? `Refazer ${history.redoLabel}` : 'Refazer'}
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+Shift+Z</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => duplicateSelected(session)}>
              <Copy aria-hidden/>
              Duplicar
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => copySelected(session)}>
              <ClipboardCopy aria-hidden/>
              Copiar
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={session.clipboard.length === 0} onClick={() => pasteClipboard(session)}>
              <ClipboardPaste aria-hidden/>
              Colar
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => groupSelected(session)}>
              <FolderInput aria-hidden/>
              Agrupar
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+G</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => ungroupSelected(session)}>
              <Ungroup aria-hidden/>
              Desagrupar
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+Shift+G</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => session.selectAll()}>
              <SquareDashed aria-hidden/>
              Selecionar tudo
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+A</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => addFolder(session)}>
              <FolderPlus aria-hidden/>
              Nova pasta
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+N</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => toggleVisibilitySelected(session)}>
              <EyeOff aria-hidden/>
              Ocultar / mostrar seleção
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>H</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => isolateEntities(session, session.selectedEntities())}>
              <Focus aria-hidden/>
              Isolar seleção
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Shift+H</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => showAllEntities(session)}>
              <Eye aria-hidden/>
              Mostrar todos
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+H</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => toggleLockSelected(session)}>
              <Lock aria-hidden/>
              Bloquear / desbloquear seleção
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>L</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => unlockAllEntities(session)}>
              <LockOpen aria-hidden/>
              Desbloquear todos
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+L</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} variant="destructive" disabled={!hasSelection} onClick={() => deleteSelected(session)}>
              <Trash2 aria-hidden/>
              Excluir
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Del</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </MenuBarMenu>

        <MenuBarMenu label="Simular">
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => playtest.togglePlayPause()}>
              {playing ? <Pause aria-hidden/> : <Play aria-hidden/>}
              {playing ? 'Pausar' : playtest.isRunning ? 'Continuar' : 'Simular física'}
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => playtest.stepOnce()}>
              <StepForward aria-hidden/>
              Avançar um passo
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!playtest.isRunning} onClick={() => playtest.stop()}>
              <Square aria-hidden/>
              Parar e restaurar
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+Shift+P</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={session.scene.player.enabled && session.scene.player.spawnIfMissing} disabled={!session.scene.player.enabled} onCheckedChange={(checked) => setPlayerSpawnIfMissing(session, checked)}>
              <PersonStanding aria-hidden/>
              Personagem do jogador ao simular
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </MenuBarMenu>

        <MenuBarMenu label="Exibir">
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={session.showGrid} onCheckedChange={() => session.toggleGrid()}>
              <Grid3x3 aria-hidden/>
              Grade
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>G</DropdownMenuShortcut>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={session.shadowsEnabled} onCheckedChange={() => session.toggleShadows()}>
              <Eclipse aria-hidden/>
              Sombras
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={session.scene.sky.enabled} onCheckedChange={() => session.toggleSky()}>
              <Sun aria-hidden/>
              Céu físico
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => session.focusSelected()}>
              <Locate aria-hidden/>
              Enquadrar seleção
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>F</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openMaterialEditor()}>
              <Palette aria-hidden/>
              Editor de materiais
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>M</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <PanelsMenuItems />
        </MenuBarMenu>

        <MenuBarMenu label="Ajuda">
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => setShortcutsOpen(true)}>
              <Keyboard aria-hidden/>
              Atalhos de teclado
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </MenuBarMenu>
      </nav>

      <div className="ml-auto flex items-center gap-3 font-mono text-2xs text-muted-foreground">
        <span className="truncate">Projetos / Sandbox / {session.scene.root.name}</span>
        <span className="rounded-sm border border-border-strong px-1.5 py-px text-[10px] tracking-wider uppercase">v0.2.0</span>
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}/>
    </div>);
}
