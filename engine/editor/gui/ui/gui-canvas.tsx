'use client';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { GUI_ROOT_ID } from '@/engine/gui/document/gui-document';
import { readAssetDragData, carriesAsset } from '@/engine/editor/library/asset-drag';
import { addGuiElement, addGuiImageElement, addGuiVideoElement, centeredGuiDropPoint, dropGuiIcon } from '@/engine/editor/operations/gui-element-operations';
import { applyFontAssetToSelection } from '@/engine/editor/operations/gui-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useElementSize } from '@/engine/ui/use-element-size';
import { pickDropContainer } from '../gui-selection';
import { GuiCanvasOverlay } from './gui-canvas-overlay';
import { carriesElement, carriesIcon, readElementDragData, readIconDragData } from './gui-drag';
import { GuiElementContextMenu } from './gui-element-context-menu';
import { GuiTextEditor } from './gui-text-editor';
import { useGuiCanvasRenderer } from './use-gui-canvas-renderer';
import { useGuiDesigner } from './use-gui-designer';
import { useGuiPointer } from './use-gui-pointer';
export function GuiCanvas() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const hostRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = useElementSize(hostRef);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const version = designer.getVersion();
    useGuiCanvasRenderer(canvasRef, hostRef, designer, size, version);
    const pointer = useGuiPointer(hostRef, session, designer);
    useEffect(() => {
        designer.setWorkspaceSize(size.width, size.height);
        if (designer.pendingFit && size.width > 0 && size.height > 0)
            designer.fitToView(size.width, size.height);
    }, [designer, size, version]);
    const layout = designer.layout();
    const editingEntry = designer.editingTextId && layout ? (layout.entries.get(designer.editingTextId) ?? null) : null;
    const toDocument = useCallback((event: {
        clientX: number;
        clientY: number;
    }) => {
        const rect = hostRef.current?.getBoundingClientRect();
        return designer.toDocument(event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0));
    }, [designer]);
    const acceptsDrag = (transfer: DataTransfer) => carriesElement(transfer) || carriesIcon(transfer) || carriesAsset(transfer);
    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (designer.mode !== 'design' || !acceptsDrag(event.dataTransfer))
            return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        const liveLayout = designer.layout();
        if (!liveLayout || !designer.document)
            return;
        const point = toDocument(event);
        const target = pickDropContainer(liveLayout, designer.document.root, point.x, point.y, []);
        const id = target.node.id === GUI_ROOT_ID ? null : target.node.id;
        if (id !== dropTargetId)
            setDropTargetId(id);
    };
    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        setDropTargetId(null);
        if (designer.mode !== 'design')
            return;
        const point = toDocument(event);
        const kind = readElementDragData(event.dataTransfer);
        if (kind) {
            event.preventDefault();
            const id = addGuiElement(session, kind, { at: centeredGuiDropPoint(session, kind, point) });
            if (id && kind === 'text')
                designer.beginTextEdit(id);
            return;
        }
        const icon = readIconDragData(event.dataTransfer);
        if (icon) {
            event.preventDefault();
            dropGuiIcon(session, icon, point);
            return;
        }
        const assetId = readAssetDragData(event.dataTransfer);
        if (!assetId)
            return;
        event.preventDefault();
        const asset = session.library.get(assetId);
        if (!asset)
            return;
        if (asset.kind === 'texture')
            addGuiImageElement(session, asset.id, asset.name, point);
        else if (asset.kind === 'video')
            addGuiVideoElement(session, asset.id, asset.name, point);
        else if (asset.kind === 'font')
            applyFontAssetToSelection(session, asset);
        else
            session.log.info('Interface', `${asset.name} não pode ser usado numa tela: solte imagens (viram elementos de imagem), vídeos (viram elementos de vídeo) ou fontes (aplicadas aos textos selecionados).`);
    };
    return (<ContextMenu>
      <ContextMenuTrigger render={<div ref={hostRef} className="relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden select-none" style={{ cursor: pointer.cursor }} aria-label="Canvas do designer de interface" {...pointer.handlers} onDragOver={onDragOver} onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    setDropTargetId(null);
            }} onDrop={onDrop}/>}>
        <canvas ref={canvasRef} className="absolute inset-0 block size-full" aria-hidden/>
        {layout && designer.mode === 'design' && (<GuiCanvasOverlay layout={layout} view={designer.view} width={size.width} height={size.height} selectedIds={designer.selectedIds} hoveredId={designer.hoveredId} frame={pointer.frame} outlines={designer.options.outlines} drag={dropTargetId ? { ...(pointer.drag ?? {}), targetId: dropTargetId } : pointer.drag} hideHandles={pointer.hideHandles || designer.editingTextId !== null}/>)}
        {layout && editingEntry && designer.mode === 'design' && <GuiTextEditor key={editingEntry.node.id} designer={designer} layout={layout} entry={editingEntry}/>}
        {designer.mode === 'preview' && (<div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <span className="flex items-center gap-2 rounded-sm border border-primary/40 bg-surface-overlay/95 px-3 py-1 font-mono text-3xs tracking-wider text-primary uppercase shadow-raised backdrop-blur-sm">
              Modo de teste · a tela responde como no jogo · Ctrl+Enter volta a editar
            </span>
          </div>)}
      </ContextMenuTrigger>
      {designer.mode === 'design' && <GuiElementContextMenu onFocus={() => designer.fitSelectionInView()}/>}
    </ContextMenu>);
}
