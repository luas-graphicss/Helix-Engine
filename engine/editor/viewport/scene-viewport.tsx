'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Pipette } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { ViewportToolbar } from './viewport-toolbar';
import { AxisGizmo } from './axis-gizmo';
import { useViewportRenderer } from './use-viewport-renderer';
import { useViewportInput, type ViewportInputHandlers } from './use-viewport-input';
import { useFileDrop } from './use-file-drop';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { EntityContextMenuContent } from '@/engine/editor/menus/entity-context-menu';
import { PlaytestHudOverlay } from '@/engine/editor/playtest/playtest-hud-overlay';
import { PerformanceHud } from '@/engine/editor/playtest/performance-hud';
import { requestImport } from '@/engine/editor/import/import-requests';
import { dropLibraryAssetOnViewport } from '@/engine/editor/operations/asset-library-operations';
import { IMPORT_FORMAT_SUMMARY } from '@/engine/assets/import/import-registry';
function ViewportContextMenu() {
    const session = useSessionTopic('scene', 'selection');
    return <EntityContextMenuContent entity={session.selectedEntity}/>;
}
function ColorPickerHint() {
    const session = useSessionTopic('view');
    if (!session.colorPicker.active)
        return null;
    return (<span className="pointer-events-none flex max-w-full items-center gap-2 rounded-sm bg-surface-overlay/95 px-3 py-1.5 text-center font-mono text-2xs text-pretty text-foreground shadow-overlay">
      <Pipette className="size-3.5 shrink-0 text-primary" aria-hidden/>
      Clique no viewport para colher a cor · Esc cancela
    </span>);
}
function SimulationFrame() {
    const { playtest } = useSessionTopic('playtest');
    if (!playtest.isRunning)
        return null;
    const playing = playtest.state === 'playing';
    return (<div aria-hidden className={cn('pointer-events-none absolute inset-0 ring-2 ring-inset transition-colors duration-200', playing ? 'ring-success/55' : 'ring-warning/55')}/>);
}
export function SceneViewport() {
    const session = useEditorSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const { error } = useViewportRenderer(canvasRef, session);
    useEffect(() => {
        session.attachViewport(canvasRef.current);
        return () => session.attachViewport(null);
    }, [session]);
    const handlers = useMemo<ViewportInputHandlers>(() => ({
        onContextMenu: (clientX, clientY) => {
            surfaceRef.current?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY }));
        },
    }), []);
    useViewportInput(canvasRef, session, handlers);
    const drop = useFileDrop(requestImport, (assetId, point) => void dropLibraryAssetOnViewport(session, assetId, point));
    return (<ContextMenu>
      <ContextMenuTrigger render={<div ref={surfaceRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-sunken" aria-label="Viewport da cena" {...drop.handlers}/>}>
        <canvas ref={canvasRef} tabIndex={0} aria-label="Cena 3D. Arraste para orbitar, Shift+arraste para panoramizar, scroll para aproximar, clique para selecionar, clique direito para o menu de contexto, F para enquadrar." className="block size-full touch-none outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-inset"/>

        <PlaytestHudOverlay />
        <SimulationFrame />
        <PerformanceHud />

        {error && (<div className="absolute inset-0 flex items-center justify-center bg-surface-sunken p-6 text-center text-2xs text-muted-foreground">
            {error}
          </div>)}

        
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1.5 p-1.5">
          <ViewportToolbar />
          <ColorPickerHint />
        </div>

        <div className="pointer-events-none absolute right-2 bottom-2">
          <AxisGizmo />
        </div>

        {drop.active && (<div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-sm border border-primary bg-background/60 shadow-[inset_0_0_0_1px_var(--primary)]">
            <span className="rounded-sm bg-surface-overlay px-3 py-1.5 font-mono text-2xs text-foreground shadow-overlay">
              {drop.payload === 'asset' ? 'Solte para colocar na cena neste ponto' : `Solte para importar (${IMPORT_FORMAT_SUMMARY})`}
            </span>
          </div>)}
      </ContextMenuTrigger>
      <ViewportContextMenu />
    </ContextMenu>);
}
