'use client';
import { useVfxGraph } from '../use-vfx-graph';
import { BlockInspector } from './block-inspector';
import { ContextInspector } from './context-inspector';
export function EffectInspector() {
    const editor = useVfxGraph();
    const { focusedContext, focusedBlock } = editor;
    if (focusedContext && focusedBlock)
        return <BlockInspector key={focusedBlock.id} context={focusedContext} block={focusedBlock}/>;
    if (focusedContext)
        return <ContextInspector key={focusedContext.id} context={focusedContext}/>;
    const selected = editor.selectedContexts.size;
    return (<p className="px-2 py-3 text-3xs leading-relaxed text-pretty text-muted-foreground">
      {selected > 1 ? `${selected} contextos selecionados.` : 'Selecione um contexto ou um bloco para editar.'}
    </p>);
}
