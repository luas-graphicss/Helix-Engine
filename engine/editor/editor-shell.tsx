'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { MenuBar } from './chrome/menu-bar';
import { MainToolbar } from './chrome/main-toolbar';
import { StatusBar } from './chrome/status-bar';
import { DockAreaView } from './layout/dock-area';
import { DockDropZones } from './layout/dock-drop-zones';
import { DockLayoutProvider, useDockLayout } from './layout/dock-layout-context';
import { SceneViewport } from './viewport/scene-viewport';
import { EditorSessionProvider, useEditorSession } from './session/editor-session-context';
import { useEditorShortcuts } from './shortcuts/use-editor-shortcuts';
import { FilePickerHost } from './files/file-picker';
import { ImportDialogHost } from './import/dialog/import-dialog-host';
import { MaterialEditorHost } from './materials/material-editor-host';
import { ViewportColorPickerProvider } from './viewport/viewport-color-picker-provider';
export function EditorShell() {
    return (<EditorSessionProvider>
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
function EditorLayout() {
    const session = useEditorSession();
    const [, dock] = useDockLayout();
    useEditorShortcuts(session, dock);
    useRevealTerrainPanel();
    return (<main className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <MenuBar />
      <MainToolbar />

      <div className="flex min-h-0 flex-1">
        <DockAreaView area="left" axis="horizontal" handleSide="after"/>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <SceneViewport />
            <DockDropZones />
          </div>
          <DockAreaView area="bottom" axis="vertical" inverted handleSide="before" className="flex shrink-0"/>
        </div>

        <DockAreaView area="right" axis="horizontal" inverted handleSide="before"/>
      </div>

      <StatusBar />
      <FilePickerHost />
      <ImportDialogHost />
      <MaterialEditorHost />
    </main>);
}
