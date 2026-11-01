'use client';
import { useDeferredValue, useEffect, useRef, useSyncExternalStore } from 'react';
import { MenuBar } from './chrome/menu-bar';
import { MainToolbar } from './chrome/main-toolbar';
import { StatusBar } from './chrome/status-bar';
import { DockAreaView } from './layout/dock-area';
import { DockDropZones } from './layout/dock-drop-zones';
import { DockLayoutProvider, useDockLayout } from './layout/dock-layout-context';
import { SceneViewport } from './viewport/scene-viewport';
import { GuiWorkspace } from './gui/ui/gui-workspace';
import { CodeWorkspace } from './code/ui/code-workspace';
import { CodeWindow } from './code/ui/code-window';
import { useCodeSelector } from './code/ui/use-code-editor';
import { CommandBar } from './chrome/command-bar';
import { refreshScriptFromStorage, scriptSync } from './operations/script-operations';
import { EditorSessionProvider, useEditorSession, useSessionSelector } from './session/editor-session-context';
import type { EditorSession } from './session/editor-session';
const WORKSPACE_TOPICS = ['workspace'] as const;
const PLAYTEST_TOPICS = ['playtest', 'scene'] as const;
import { cn } from '@/lib/utils';
import { useEditorShortcuts } from './shortcuts/use-editor-shortcuts';
import { EditorDialogHost } from './dialogs/editor-dialog-host';
import { FilePickerHost } from './files/file-picker';
import { ImportDialogHost } from './import/dialog/import-dialog-host';
import { MaterialEditorHost } from './materials/material-editor-host';
import { ViewportColorPickerProvider } from './viewport/viewport-color-picker-provider';
import { useEngineSetting } from '@/engine/settings/engine-settings-store';
import { useLiveSessionSettings, useRevealConsoleOnError, useWindowFocusPolicies } from '@/engine/settings/apply/use-engine-settings-effects';
export function EditorShell({ session }: {
    session: EditorSession;
}) {
    return (<EditorSessionProvider session={session}>
      <DockLayoutProvider>
        <ViewportColorPickerProvider>
          <EditorLayout />
        </ViewportColorPickerProvider>
      </DockLayoutProvider>
    </EditorSessionProvider>);
}
function useRevealTerrainPanel() {
    const session = useEditorSession();
    const [, dock] = useDockLayout();
    const tool = useSyncExternalStore(session.subscribe, () => session.tool, () => session.tool);
    useEffect(() => {
        if (tool === 'terrain')
            dock.reveal('terrain');
    }, [tool, dock]);
}
function useRevealAudioPanel() {
    const { audio } = useEditorSession();
    const [, dock] = useDockLayout();
    const openCount = useSyncExternalStore(audio.subscribe, () => audio.openCount, () => audio.openCount);
    useEffect(() => {
        if (openCount > 0)
            dock.reveal('audio');
    }, [openCount, dock]);
}
function useRevealAnimationPanel() {
    const { animation } = useEditorSession();
    const [, dock] = useDockLayout();
    const openCount = useSyncExternalStore(animation.subscribe, () => animation.openCount, () => animation.openCount);
    useEffect(() => {
        if (openCount > 0)
            dock.reveal('animation');
    }, [openCount, dock]);
}
function useRevealVfxPanel() {
    const { vfx } = useEditorSession();
    const [, dock] = useDockLayout();
    const openCount = useSyncExternalStore(vfx.subscribe, () => vfx.openCount, () => vfx.openCount);
    useEffect(() => {
        if (openCount > 0)
            dock.reveal('vfx');
    }, [openCount, dock]);
}
function useMaximizeOnPlay() {
    const running = useSessionSelector((current) => current.playtest.isRunning, { topics: PLAYTEST_TOPICS });
    const [, dock] = useDockLayout();
    const enabled = useEngineSetting('simulation.playMaximized');
    const maximizedByPlay = useRef(false);
    useEffect(() => {
        if (running) {
            if (!enabled || dock.getSnapshot().maximized)
                return;
            dock.maximizeViewport();
            maximizedByPlay.current = true;
            return;
        }
        if (!maximizedByPlay.current)
            return;
        maximizedByPlay.current = false;
        dock.restorePanels();
    }, [running, enabled, dock]);
}
function useScriptSync() {
    const session = useEditorSession();
    useEffect(() => scriptSync.listen(session, (assetId) => void refreshScriptFromStorage(session, assetId)), [session]);
}
function useRevealScriptsPanel() {
    const { code } = useEditorSession();
    const [, dock] = useDockLayout();
    const openCount = useSyncExternalStore(code.subscribe, () => code.openCount, () => code.openCount);
    useEffect(() => {
        if (openCount > 0 && dock.isOpen('scripts'))
            dock.reveal('scripts');
    }, [openCount, dock]);
}
function WorkspaceCenter() {
    const session = useEditorSession();
    const requested = useSessionSelector((current) => current.workspace, { topics: WORKSPACE_TOPICS });
    const workspace = useDeferredValue(requested);
    const windowPresentation = useCodeSelector((code) => code.windowOpen && code.presentation === 'window');
    const covered = workspace !== 'scene';
    const floatingCode = windowPresentation && workspace !== 'code';
    useEffect(() => {
        session.viewportGovernor.setCovered(covered);
        return () => session.viewportGovernor.setCovered(false);
    }, [session, covered]);
    return (<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', covered && 'invisible')} inert={covered || undefined} aria-hidden={covered || undefined}>
        <SceneViewport />
      </div>
      {workspace === 'gui' && <GuiWorkspace />}
      {workspace === 'code' && <CodeWorkspace />}
      {floatingCode && <CodeWindow />}
      <DockDropZones />
    </div>);
}
function WorkspaceCommandBar() {
    const visible = useCodeSelector((code) => code.commandBarVisible);
    return visible ? <CommandBar /> : null;
}
function EditorLayout() {
    const session = useEditorSession();
    const [, dock] = useDockLayout();
    const statusBar = useEngineSetting('editor.ui.statusBar');
    useEditorShortcuts(session, dock);
    useLiveSessionSettings(session);
    useWindowFocusPolicies(session);
    useRevealConsoleOnError(session, dock);
    useRevealTerrainPanel();
    useRevealAudioPanel();
    useRevealAnimationPanel();
    useRevealVfxPanel();
    useRevealScriptsPanel();
    useMaximizeOnPlay();
    useScriptSync();
    return (<main className="relative flex h-dvh w-full flex-col overflow-clip bg-background text-foreground">
      <MenuBar />
      <MainToolbar />

      <div className="flex min-h-0 flex-1">
        <DockAreaView area="left" axis="horizontal" handleSide="after"/>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceCenter />
          <DockAreaView area="bottom" axis="vertical" inverted handleSide="before" className="flex shrink-0"/>
        </div>

        <DockAreaView area="right" axis="horizontal" inverted handleSide="before"/>
      </div>

      <WorkspaceCommandBar />
      {statusBar && <StatusBar />}
      <EditorDialogHost />
      <FilePickerHost />
      <ImportDialogHost />
      <MaterialEditorHost />
    </main>);
}
