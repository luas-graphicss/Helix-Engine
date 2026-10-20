'use client';
import { useMemo, useRef } from 'react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ViewportToolbar } from './viewport-toolbar';
import { AxisGizmo } from './axis-gizmo';
import { ViewportStatsOverlay } from './viewport-stats-overlay';
import { useViewportRenderer } from './use-viewport-renderer';
import { useViewportInput, type ViewportInputHandlers } from './use-viewport-input';
import { useFileDrop } from './use-file-drop';
import { useEditorSession, useEditorState } from '@/engine/editor/session/editor-session-context';
import { EntityContextMenuContent } from '@/engine/editor/menus/entity-context-menu';
import { PlaytestBadge } from '@/engine/editor/playtest/playtest-badge';
import { requestImport } from '@/engine/editor/import/import-requests';
import { IMPORT_FORMAT_SUMMARY } from '@/engine/assets/import/import-registry';
function ViewportContextMenu() {
    const session = useEditorState();
    return <EntityContextMenuContent entity={session.selectedEntity}/>;
}
export function SceneViewport() {
    const session = useEditorSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const { error } = useViewportRenderer(canvasRef, session);
    const handlers = useMemo<ViewportInputHandlers>(() => ({
        onContextMenu: (clientX, clientY) => {
            surfaceRef.current?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY }));
        },
    }), []);
    useViewportInput(canvasRef, session, handlers);
    const drop = useFileDrop(requestImport);
    return (<ContextMenu>
      <ContextMenuTrigger render={<div ref={surfaceRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-sunken" aria-label="Viewport da cena" {...drop.handlers}/>}>
        <canvas ref={canvasRef} tabIndex={0} aria-label="Cena 3D. Arraste para orbitar, Shift+arraste para panoramizar, scroll para aproximar, clique para selecionar, clique direito para o menu de contexto, F para enquadrar." className="block size-full touch-none outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-inset"/>

        {error && (<div className="absolute inset-0 flex items-center justify-center bg-surface-sunken p-6 text-center text-2xs text-muted-foreground">
            {error}
          </div>)}

        <ViewportToolbar />
        <PlaytestBadge />

        <div className="pointer-events-none absolute right-2 bottom-2">
          <AxisGizmo />
        </div>

        <ViewportStatsOverlay />

        {drop.active && (<div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-sm border border-dashed border-primary bg-background/60">
            <span className="rounded-sm border border-border bg-surface-raised px-3 py-1.5 font-mono text-2xs text-foreground">Solte para importar ({IMPORT_FORMAT_SUMMARY})</span>
          </div>)}
      </ContextMenuTrigger>
      <ViewportContextMenu />
    </ContextMenu>);
}
