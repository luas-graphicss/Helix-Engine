'use client';
import { ListTree, SlidersHorizontal, FolderOpen, Terminal, CloudSun, Atom, Gauge } from 'lucide-react';
import { MenuBar } from './chrome/menu-bar';
import { MainToolbar } from './chrome/main-toolbar';
import { StatusBar } from './chrome/status-bar';
import { PanelFrame } from './layout/panel-frame';
import { ResizeHandle } from './layout/resize-handle';
import { useResizableSize } from './layout/use-resizable-size';
import { HierarchyPanel } from './panels/hierarchy-panel';
import { InspectorPanel } from './panels/inspector-panel';
import { EnvironmentPanel } from './panels/environment-panel';
import { PhysicsPanel } from './panels/physics-panel';
import { PerformancePanel } from './panels/performance-panel';
import { AssetsPanel } from './panels/assets-panel';
import { ConsolePanel } from './panels/console-panel';
import { SceneViewport } from './viewport/scene-viewport';
import { EditorSessionProvider, useEditorSession } from './session/editor-session-context';
import { useEditorShortcuts } from './shortcuts/use-editor-shortcuts';
import { ImportFilePicker } from './import/import-file-picker';
import { ImportDialogHost } from './import/dialog/import-dialog-host';
const LEFT_PANEL = { initial: 260, min: 200, max: 480 };
const RIGHT_PANEL = { initial: 320, min: 240, max: 560 };
const BOTTOM_PANEL = { initial: 240, min: 120, max: 520 };
type RightPanelId = 'inspector' | 'environment' | 'physics' | 'performance';
const RIGHT_PANELS: Record<RightPanelId, React.ReactNode> = {
    inspector: <InspectorPanel />,
    environment: <EnvironmentPanel />,
    physics: <PhysicsPanel />,
    performance: <PerformancePanel />,
};
export function EditorShell() {
    return (<EditorSessionProvider>
      <EditorLayout />
    </EditorSessionProvider>);
}
function EditorLayout() {
    const session = useEditorSession();
    useEditorShortcuts(session);
    const left = useResizableSize({ ...LEFT_PANEL, axis: 'horizontal' });
    const right = useResizableSize({ ...RIGHT_PANEL, axis: 'horizontal', inverted: true });
    const bottom = useResizableSize({ ...BOTTOM_PANEL, axis: 'vertical', inverted: true });
    const isResizing = left.isResizing || right.isResizing || bottom.isResizing;
    return (<main className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground" style={{ cursor: isResizing ? (bottom.isResizing ? 'row-resize' : 'col-resize') : undefined }}>
      <MenuBar />
      <MainToolbar />

      <div className="flex min-h-0 flex-1">
        <aside className="flex shrink-0 flex-col" style={{ width: left.size }}>
          <PanelFrame tabs={[{ id: 'hierarchy', label: 'Hierarquia', icon: ListTree }]} renderTab={() => <HierarchyPanel />}/>
        </aside>

        <ResizeHandle axis="horizontal" active={left.isResizing} label="Redimensionar painel esquerdo" {...left.handleProps}/>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SceneViewport />

          <ResizeHandle axis="vertical" active={bottom.isResizing} label="Redimensionar painel inferior" {...bottom.handleProps}/>

          <div className="flex shrink-0" style={{ height: bottom.size }}>
            <PanelFrame tabs={[
            { id: 'assets', label: 'Ativos', icon: FolderOpen },
            { id: 'console', label: 'Console', icon: Terminal },
        ]} renderTab={(id) => (id === 'assets' ? <AssetsPanel /> : <ConsolePanel />)}/>
          </div>
        </div>

        <ResizeHandle axis="horizontal" active={right.isResizing} label="Redimensionar painel direito" {...right.handleProps}/>

        <aside className="flex shrink-0 flex-col" style={{ width: right.size }}>
          <PanelFrame tabs={[
            { id: 'inspector', label: 'Inspetor', icon: SlidersHorizontal },
            { id: 'environment', label: 'Ambiente', icon: CloudSun },
            { id: 'physics', label: 'Física', icon: Atom },
            { id: 'performance', label: 'Desempenho', icon: Gauge },
        ]} renderTab={(id) => RIGHT_PANELS[id as RightPanelId]}/>
        </aside>
      </div>

      <StatusBar />
      <ImportFilePicker />
      <ImportDialogHost />
    </main>);
}
