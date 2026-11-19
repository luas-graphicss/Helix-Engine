'use client';
import { ArrowDown, ArrowUp, Power, Trash2 } from 'lucide-react';
import { blockDefinition } from '@/engine/vfx-graph/blocks/block-catalog';
import type { EffectBlock, EffectContext } from '@/engine/vfx-graph/document/effect-document';
import { IconButton } from '@/engine/ui/icon-button';
import { useVfxGraph } from '../use-vfx-graph';
import { InspectorHeader } from './inspector-header';
import { ParamEditor } from './param-editor';
type BlockInspectorProps = {
    context: EffectContext;
    block: EffectBlock;
};
const UNKNOWN_BLOCK_NOTE = 'Este bloco veio de uma versão que a engine não conhece: exclua-o para o efeito voltar a compilar.';
export function BlockInspector({ context, block }: BlockInspectorProps) {
    const editor = useVfxGraph();
    const definition = blockDefinition(block.type);
    const index = context.blocks.findIndex((candidate) => candidate.id === block.id);
    return (<div className="flex flex-col gap-1 py-2">
      <InspectorHeader title={definition?.label ?? 'Bloco desconhecido'} description={definition?.description ?? UNKNOWN_BLOCK_NOTE}>
        <IconButton label="Mover bloco para cima" size="xs" disabled={index <= 0} onClick={() => editor.moveBlock(context.id, block.id, -1)}>
          <ArrowUp aria-hidden/>
        </IconButton>
        <IconButton label="Mover bloco para baixo" size="xs" disabled={index >= context.blocks.length - 1} onClick={() => editor.moveBlock(context.id, block.id, 1)}>
          <ArrowDown aria-hidden/>
        </IconButton>
        <IconButton label="Bloco ligado" size="xs" active={block.enabled} onClick={() => editor.setBlockEnabled(context.id, block.id, !block.enabled)}>
          <Power aria-hidden/>
        </IconButton>
        <IconButton label="Excluir bloco" size="xs" onClick={() => editor.removeBlock(context.id, block.id)}>
          <Trash2 aria-hidden/>
        </IconButton>
      </InspectorHeader>
      {definition?.params.map((param) => <ParamEditor key={param.id} param={param} value={block.values[param.id]} onChange={(value) => editor.setBlockValue(context.id, block.id, param.id, value)}/>)}
      {definition?.params.length === 0 && <p className="px-2 text-3xs text-muted-foreground">Este bloco não tem parâmetros.</p>}
    </div>);
}
