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
    contentClassName?: string;
    children: ReactNode;
}) {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className={MENU_TRIGGER_CLASS}/>}>{label}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2} className={contentClassName ? `${MENU_CONTENT_CLASS} ${contentClassName}` : MENU_CONTENT_CLASS}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>);
}
function HelixMenu() {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Menu Helix" className={`${MENU_TRIGGER_CLASS} mr-1 flex items-center gap-1.5 pr-2.5 pl-2 shadow-[1px_0_0_0_var(--border),2px_0_0_0_var(--bevel)]`}/>}>
        <HelixLogo size={16}/>
        <span className="text-3xs font-semibold tracking-[0.22em] text-foreground">HELIX</span>
        <ChevronDown className="size-3 text-muted-foreground/70" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2} className={`${MENU_CONTENT_CLASS} min-w-80 [&_[role=menuitem]]:whitespace-nowrap`}>
        <HelixMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>);
}
function SceneEditMenuItems() {
    const session = useSessionTopic('scene', 'selection', 'view', 'workspace', 'project');
    const { history } = session;
    const hasSelection = session.selectedEntity !== null;
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!history.canUndo} onClick={() => history.undo()}>
          <Undo2 aria-hidden/>
          {history.undoLabel ? `Desfazer ${history.undoLabel}` : 'Desfazer'}
          <MenuShortcut action="edit.undo"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!history.canRedo} onClick={() => history.redo()}>
          <Redo2 aria-hidden/>
          {history.redoLabel ? `Refazer ${history.redoLabel}` : 'Refazer'}
          <MenuShortcut action="edit.redo"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => duplicateSelected(session)}>
          <Copy aria-hidden/>
          Duplicar
          <MenuShortcut action="edit.duplicate"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => copySelected(session)}>
          <ClipboardCopy aria-hidden/>
          Copiar
          <MenuShortcut action="edit.copy"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={session.clipboard.length === 0} onClick={() => pasteClipboard(session)}>
          <ClipboardPaste aria-hidden/>
          Colar
          <MenuShortcut action="edit.paste"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => groupSelected(session)}>
          <FolderInput aria-hidden/>
          Agrupar
          <MenuShortcut action="edit.group"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => ungroupSelected(session)}>
          <Ungroup aria-hidden/>
          Desagrupar
          <MenuShortcut action="edit.ungroup"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => session.selectAll()}>
          <SquareDashed aria-hidden/>
          Selecionar tudo
          <MenuShortcut action="edit.selectAll"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => addFolder(session)}>
          <FolderPlus aria-hidden/>
          Nova pasta
          <MenuShortcut action="edit.newFolder"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => toggleVisibilitySelected(session)}>
          <EyeOff aria-hidden/>
          Ocultar / mostrar seleção
          <MenuShortcut action="selection.toggleVisibility"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => isolateEntities(session, session.selectedEntities())}>
          <Focus aria-hidden/>
          Isolar seleção
          <MenuShortcut action="selection.isolate"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => showAllEntities(session)}>
          <Eye aria-hidden/>
          Mostrar todos
          <MenuShortcut action="selection.showAll"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => toggleLockSelected(session)}>
          <Lock aria-hidden/>
          Bloquear / desbloquear seleção
          <MenuShortcut action="selection.toggleLock"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => unlockAllEntities(session)}>
          <LockOpen aria-hidden/>
          Desbloquear todos
          <MenuShortcut action="selection.unlockAll"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} variant="destructive" disabled={!hasSelection} onClick={() => deleteSelected(session)}>
          <Trash2 aria-hidden/>
          Excluir
          <MenuShortcut action="edit.delete"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
}
function UiScaleMenuItems() {
    const scale = useEngineSetting('editor.ui.scale');
    return (<DropdownMenuRadioGroup value={scale} onValueChange={(value) => engineSettings.set('editor.ui.scale', value as UiScaleValue)}>
      <DropdownMenuGroup>
        <DropdownMenuLabel className={MENU_LABEL_CLASS}>Tamanho da interface</DropdownMenuLabel>
        {UI_SCALE_OPTIONS.map((option) => (<DropdownMenuRadioItem key={option.value} className={MENU_ITEM_CLASS} value={option.value} title={option.hint}>
            {option.label}
          </DropdownMenuRadioItem>))}
      </DropdownMenuGroup>
    </DropdownMenuRadioGroup>);
}
export function MenuBar() {
    const session = useSessionTopic('scene', 'selection', 'view', 'workspace', 'project');
    const projectName = useProjectName();
    const { playtest } = session;
    const hasSelection = session.selectedEntity !== null;
    const playing = playtest.state === 'playing';
    const designing = session.workspace === 'gui';
    return (<div className="flex h-menubar shrink-0 items-center border-b border-border bg-surface-sunken px-1.5">
      <nav aria-label="Menu principal" className="flex h-full shrink-0 items-stretch">
        <HelixMenu />

        <MenuBarMenu label="Arquivo">
          <ProjectMenuItems />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openImportFilePicker()}>
              <Import aria-hidden/>
              Importar modelo…
              <MenuShortcut action="file.import"/>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => pickFilesForLibrary(session)}>
              <LibraryBig aria-hidden/>
              Adicionar à biblioteca…
              <MenuShortcut action="file.addToLibrary"/>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </MenuBarMenu>

        <MenuBarMenu label="Editar">{designing ? <GuiEditMenuItems /> : <SceneEditMenuItems />}</MenuBarMenu>

        <MenuBarMenu label="Interface">
          <InterfaceMenuItems />
        </MenuBarMenu>

        <MenuBarMenu label="Código">
          <CodeMenuItems />
        </MenuBarMenu>

        <MenuBarMenu label="Simular">
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => playtest.togglePlayPause()}>
              {playing ? <Pause aria-hidden/> : <Play aria-hidden/>}
              {playing ? 'Pausar' : playtest.isRunning ? 'Continuar' : 'Simular física'}
              <MenuShortcut action="simulation.playPause"/>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => playtest.stepOnce()}>
              <StepForward aria-hidden/>
              Avançar um passo
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!playtest.isRunning} onClick={() => playtest.stop()}>
              <Square aria-hidden/>
              Parar e restaurar
              <MenuShortcut action="simulation.stop"/>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={session.scene.player.enabled} onCheckedChange={(checked) => setPlayerEnabled(session, checked)}>
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
              <MenuShortcut action="view.toggleGrid"/>
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
              <MenuShortcut action="selection.focus"/>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openMaterialEditor()}>
              <Palette aria-hidden/>
              Editor de materiais
              <MenuShortcut action="view.materialEditor"/>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <PanelsMenuItems />
          <DropdownMenuSeparator />
          <UiScaleMenuItems />
        </MenuBarMenu>

        <MenuBarMenu label="Ajuda" contentClassName="[&_[role=menuitem]]:whitespace-nowrap">
          <HelpMenuItems />
        </MenuBarMenu>
      </nav>

      <div className="ml-auto flex h-full min-w-0 flex-1 items-center justify-end font-mono text-2xs text-muted-foreground">
        <button type="button" className="flex h-5 min-w-0 items-center gap-1.5 rounded-sm px-1.5 transition-colors duration-100 hover:bg-highlight hover:text-foreground" title={`${projectName} / ${session.scene.root.name} · Renomear jogo`} onClick={() => editorDialogs.open('renameProject')}>
          <span className="truncate text-foreground/90">{projectName}</span>
          <span className="shrink-0 text-muted-foreground/50">/</span>
          <span className="truncate">{session.scene.root.name}</span>
        </button>
      </div>
    </div>);
}
