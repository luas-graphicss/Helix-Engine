'use client';
import { useEffect, useRef } from 'react';
import type { EffectDiagnostic } from '@/engine/vfx-graph/compiler/effect-compiler';
import { useElementSize } from '@/engine/ui/use-element-size';
import { useVfxGraph } from '../use-vfx-graph';
import { ContextCard, type ContextProblem } from './context-card';
import { FlowWires } from './flow-wires';
import { useCanvasGestures } from './use-canvas-gestures';
const GRID_SPACING = 24;
const NO_DIAGNOSTICS: readonly EffectDiagnostic[] = [];
function contextProblems(diagnostics: readonly EffectDiagnostic[]): Map<string, ContextProblem> {
    const problems = new Map<string, ContextProblem>();
    for (const { contextId, severity } of diagnostics) {
        if (contextId && problems.get(contextId) !== 'error')
            problems.set(contextId, severity);
    }
    return problems;
}
export function EffectCanvas() {
    const editor = useVfxGraph();
    const rootRef = useRef<HTMLDivElement>(null);
    const size = useElementSize(rootRef);
    const { pendingFlow, handlers } = useCanvasGestures(editor, rootRef);
    useEffect(() => editor.setViewportSize(size), [editor, size]);
    const graph = editor.document;
    if (!graph)
        return null;
    const { view, selectedContexts, selectedBlock } = editor;
    const diagnostics = editor.compiled?.diagnostics ?? NO_DIAGNOSTICS;
    const problems = contextProblems(diagnostics);
    const failedBlocks = new Set(diagnostics.flatMap((diagnostic) => (diagnostic.severity === 'error' && diagnostic.blockId ? [diagnostic.blockId] : [])));
    const grid = GRID_SPACING * view.zoom;
    return (<div ref={rootRef} role="application" aria-label="Grafo de efeito: arraste o fundo para mover, role para aproximar, puxe da saída de um contexto até o próximo para ligar" className="relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden bg-surface-sunken select-none" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }} {...handlers}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <FlowWires graph={graph} pendingFlow={pendingFlow}/>
        {graph.contexts.map((context) => <ContextCard key={context.id} context={context} selected={selectedContexts.has(context.id)} focusedBlockId={selectedBlock?.contextId === context.id ? selectedBlock.blockId : null} problem={problems.get(context.id) ?? null} failedBlocks={failedBlocks}/>)}
      </div>
    </div>);
}
