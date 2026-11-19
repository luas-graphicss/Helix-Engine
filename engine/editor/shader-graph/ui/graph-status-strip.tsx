'use client';
import { useState } from 'react';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { useShaderGraph } from './use-shader-graph';
const ACTION_CLASS = cn('rounded-xs px-1.5 text-3xs text-muted-foreground transition-colors duration-100 hover:bg-highlight hover:text-foreground disabled:pointer-events-none disabled:opacity-40', FOCUS_RING_CLASS);
const STATUS_DOT_CLASS = { error: 'bg-destructive', warning: 'bg-warning', ready: 'bg-success' } as const;
export function GraphStatusStrip() {
    const editor = useShaderGraph();
    const [codeOpen, setCodeOpen] = useState(false);
    const { compiled } = editor;
    const graph = editor.document;
    if (!compiled || !graph)
        return null;
    const problem = compiled.diagnostics.find((diagnostic) => diagnostic.severity === 'error') ?? compiled.diagnostics.at(0) ?? null;
    const summary = `Compilado: ${graph.nodes.length} nós, ${graph.links.length} ligações, ${compiled.uniforms.length} uniformes`;
    return (<footer className="shrink-0 border-t border-border bg-surface">
      {codeOpen && (<pre className="max-h-56 overflow-auto border-b border-border bg-surface-sunken p-2 font-mono text-3xs leading-relaxed text-foreground select-text">
          {compiled.source === '' ? 'O grafo tem erros: corrija-os para gerar o GLSL.' : compiled.source}
        </pre>)}
      <div className="flex h-statusbar items-center gap-2 px-2">
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[problem?.severity ?? 'ready'])}/>
        <span role="status" className={cn('min-w-0 flex-1 truncate text-3xs', problem?.severity === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{problem?.message ?? summary}</span>
        <button type="button" disabled={compiled.source === ''} onClick={() => void copyTextToClipboard(compiled.source)} className={ACTION_CLASS}>
          Copiar GLSL
        </button>
        <button type="button" aria-expanded={codeOpen} onClick={() => setCodeOpen((open) => !open)} className={ACTION_CLASS}>
          {codeOpen ? 'Ocultar GLSL' : 'Ver GLSL'}
        </button>
      </div>
    </footer>);
}
