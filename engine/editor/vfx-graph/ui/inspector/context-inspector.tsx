'use client';
import { Trash2 } from 'lucide-react';
import { CONTEXT_DEFINITIONS } from '@/engine/vfx-graph/contexts/context-catalog';
import type { EffectContext } from '@/engine/vfx-graph/document/effect-document';
import { IconButton } from '@/engine/ui/icon-button';
import { useVfxGraph } from '../use-vfx-graph';
import { InspectorHeader } from './inspector-header';
import { ParamEditor } from './param-editor';
type ContextInspectorProps = {
    context: EffectContext;
};
export function ContextInspector({ context }: ContextInspectorProps) {
    const editor = useVfxGraph();
    const definition = CONTEXT_DEFINITIONS[context.kind];
    return (<div className="flex flex-col gap-1 py-2">
      <InspectorHeader title={definition.label} description={definition.description}>
        <IconButton label="Excluir contexto" size="xs" onClick={() => editor.removeSelected()}>
          <Trash2 aria-hidden/>
        </IconButton>
      </InspectorHeader>
      {definition.settings.map((param) => <ParamEditor key={param.id} param={param} value={context.values[param.id]} onChange={(value) => editor.setContextValue(context.id, param.id, value)}/>)}
    </div>);
}
