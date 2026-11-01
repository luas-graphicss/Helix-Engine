'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Code2, GripHorizontal, Maximize2, Minimize2, PanelsTopLeft, X } from 'lucide-react';
import { revealCodeEditor } from '@/engine/editor/operations/script-operations';
import { shallowEqual, useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { CODE_WINDOW_MIN_HEIGHT, CODE_WINDOW_MIN_WIDTH, type CodeWindowRect } from '../code-editor';
import { CodeEmptyState } from './code-empty-state';
import { CodeToolbar } from './code-toolbar';
import { CodeEditorBody } from './code-workspace';
import { useCodeActions, useCodeSelector } from './use-code-editor';
const MAXIMIZED_MARGIN = 8;
const KEEP_VISIBLE = 48;
type Gesture = {
    kind: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: CodeWindowRect;
    box: DOMRect;
};
function clampRect(rect: CodeWindowRect, bounds: DOMRect): CodeWindowRect {
    const width = Math.min(Math.max(CODE_WINDOW_MIN_WIDTH, rect.width), Math.max(CODE_WINDOW_MIN_WIDTH, bounds.width));
    const height = Math.min(Math.max(CODE_WINDOW_MIN_HEIGHT, rect.height), Math.max(CODE_WINDOW_MIN_HEIGHT, bounds.height));
    const x = Math.min(Math.max(rect.x, KEEP_VISIBLE - width), bounds.width - KEEP_VISIBLE);
    const y = Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - KEEP_VISIBLE));
    return { x, y, width, height };
}
export function CodeWindow() {
    const session = useEditorSession();
    const code = useCodeActions();
    const { windowRect, windowMaximized, activeName, isOpen } = useCodeSelector((current) => ({ windowRect: current.windowRect, windowMaximized: current.windowMaximized, activeName: current.activeTab?.document.name ?? null, isOpen: current.isOpen }), shallowEqual);
    const frameRef = useRef<HTMLDivElement>(null);
    const gestureRef = useRef<Gesture | null>(null);
    const [liveRect, setLiveRect] = useState<CodeWindowRect | null>(null);
    const rect = liveRect ?? windowRect;
    const bounds = useCallback((): DOMRect | null => frameRef.current?.parentElement?.getBoundingClientRect() ?? null, []);
    useEffect(() => {
        const box = bounds();
        if (!box || windowMaximized)
            return;
        const clamped = clampRect(windowRect, box);
        if (clamped.x !== windowRect.x || clamped.y !== windowRect.y || clamped.width !== windowRect.width || clamped.height !== windowRect.height)
            code.setWindowRect(clamped);
    }, [code, windowRect, windowMaximized, bounds]);
    const begin = (kind: Gesture['kind']) => (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0 || windowMaximized)
            return;
        if (kind === 'move' && (event.target as HTMLElement).closest('button'))
            return;
        const box = bounds();
        if (!box)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gestureRef.current = { kind, startX: event.clientX, startY: event.clientY, origin: windowRect, box };
    };
    const update = (event: ReactPointerEvent<HTMLElement>) => {
        const gesture = gestureRef.current;
        if (!gesture)
            return;
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        const next = gesture.kind === 'move'
            ? { ...gesture.origin, x: gesture.origin.x + dx, y: gesture.origin.y + dy }
            : { ...gesture.origin, width: gesture.origin.width + dx, height: gesture.origin.height + dy };
        setLiveRect(clampRect(next, gesture.box));
    };
    const finish = (event: ReactPointerEvent<HTMLElement>) => {
        if (!gestureRef.current)
            return;
        gestureRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (liveRect)
            code.setWindowRect(liveRect);
        setLiveRect(null);
    };
    const style = windowMaximized ? { inset: MAXIMIZED_MARGIN } : { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
    return (<div ref={frameRef} role="dialog" aria-label="Editor de código" style={style} className={cn('absolute z-30 flex flex-col overflow-hidden rounded-sm border border-border-strong bg-surface shadow-overlay', liveRect && 'select-none')}>
      <div onPointerDown={begin('move')} onPointerMove={update} onPointerUp={finish} onPointerCancel={finish} onDoubleClick={(event) => {
            if (!(event.target as HTMLElement).closest('button'))
                code.toggleWindowMaximized();
        }} className={cn('flex h-7 shrink-0 items-center gap-1.5 border-b border-border bg-surface-sunken px-1.5 text-2xs', windowMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing')}>
        <GripHorizontal className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
        <Code2 className="size-3.5 shrink-0 text-primary" aria-hidden/>
        <span className="truncate font-medium text-foreground">
          Código
          {activeName !== null && <span className="font-normal text-muted-foreground"> · {activeName}</span>}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <IconButton label="Levar para a área de trabalho (no lugar do viewport)" size="sm" onClick={() => {
            code.closeWindow();
            revealCodeEditor(session, 'workspace');
        }}>
            <PanelsTopLeft />
          </IconButton>
          <IconButton label={windowMaximized ? 'Restaurar o tamanho' : 'Maximizar a janela'} size="sm" onClick={() => code.toggleWindowMaximized()}>
            {windowMaximized ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
          <IconButton label="Fechar a janela (as abas continuam abertas)" size="sm" onClick={() => code.closeWindow()}>
            <X />
          </IconButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {isOpen ? (<>
            <CodeToolbar compact/>
            <CodeEditorBody />
          </>) : (<div className="relative min-h-0 flex-1">
            <CodeEmptyState />
          </div>)}
      </div>

      {!windowMaximized && (<div role="presentation" title="Redimensionar" onPointerDown={begin('resize')} onPointerMove={update} onPointerUp={finish} onPointerCancel={finish} className="absolute right-0 bottom-0 size-4 cursor-nwse-resize">
          <span aria-hidden className="absolute right-1 bottom-1 size-2 border-r-2 border-b-2 border-border-strong"/>
        </div>)}
    </div>);
}
