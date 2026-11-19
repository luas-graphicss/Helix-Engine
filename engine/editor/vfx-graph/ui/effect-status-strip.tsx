'use client';
import { useState } from 'react';
import { findContext } from '@/engine/vfx-graph/document/effect-document';
import { systemOf } from '@/engine/vfx-graph/document/effect-systems';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { contextCenter, viewCenteredOn } from './canvas/canvas-geometry';
import { useVfxGraph } from './use-vfx-graph';
const ACTION_CLASS = cn('rounded-xs px-1.5 text-3xs text-muted-foreground transition-colors duration-100 hover:bg-highlight hover:text-foreground disabled:pointer-events-none disabled:opacity-40', FOCUS_RING_CLASS);
const STATUS_DOT_CLASS = { error: 'bg-destructive', warning: 'bg-warning', ready: 'bg-success' } as const;
const COUNT_FORMAT = new Intl.NumberFormat('pt-BR');
function counted(count: number, singular: string, plural: string): string {
    return `${COUNT_FORMAT.format(count)} ${count === 1 ? singular : plural}`;
}
export function EffectStatusStrip() {
    const editor = useVfxGraph();
    const [codeOpen, setCodeOpen] = useState(false);
    const { compiled, focusedContext } = editor;
    const graph = editor.document;
    if (!compiled || !graph)
        return null;
    const problem = compiled.diagnostics.find((diagnostic) => diagnostic.severity === 'error') ?? compiled.diagnostics.at(0) ?? null;
    const problemContext = problem?.contextId ? findContext(graph, problem.contextId) : null;
    const summary = `Compilado: ${counted(compiled.systems.length, 'sistema', 'sistemas')}, ${counted(compiled.blockCount, 'bloco', 'blocos')}, capacidade de ${counted(compiled.capacity, 'partícula', 'partículas')}`;
    const focusedSystemId = focusedContext ? systemOf(graph, focusedContext.id)?.id : undefined;
    const source = (compiled.systems.find((system) => system.id === focusedSystemId) ?? compiled.systems.at(0))?.simulation ?? '';
    const revealProblem = () => {
        if (!problemContext)
            return;
        if (problem?.blockId)
            editor.selectBlock(problemContext.id, problem.blockId);
        else
            editor.selectContext(problemContext.id, false);
        editor.setView(viewCenteredOn(editor.view, editor.viewportSize, contextCenter(problemContext)));
    };
    return (<footer className="shrink-0 border-t border-border bg-surface">
      {codeOpen && (<pre className="max-h-56 overflow-auto border-b border-border bg-surface-sunken p-2 font-mono text-3xs leading-relaxed text-foreground select-text">
          {source === '' ? 'Nenhum sistema para simular: ligue uma Inicialização para gerar o GLSL.' : source}
        </pre>)}
      <div className="flex h-statusbar items-center gap-2 px-2">
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[problem?.severity ?? 'ready'])}/>
        <span role="status" className={cn('min-w-0 flex-1 truncate text-3xs', problem?.severity === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{problem?.message ?? summary}</span>
        {problemContext && (<button type="button" onClick={revealProblem} className={ACTION_CLASS}>
            Mostrar no grafo
          </button>)}
        <button type="button" disabled={source === ''} onClick={() => void copyTextToClipboard(source)} className={ACTION_CLASS}>
          Copiar GLSL
        </button>
        <button type="button" aria-expanded={codeOpen} onClick={() => setCodeOpen((open) => !open)} className={ACTION_CLASS}>
          {codeOpen ? 'Ocultar GLSL' : 'Ver GLSL'}
        </button>
      </div>
    </footer>);
}
