'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { blocksForStage } from '@/engine/vfx-graph/blocks/block-catalog';
import type { BlockDefinition } from '@/engine/vfx-graph/blocks/block-definition';
import { CONTEXT_DEFINITIONS } from '@/engine/vfx-graph/contexts/context-catalog';
import { CONTEXT_WIDTH } from '@/engine/vfx-graph/document/context-layout';
import { CONTEXT_KINDS, type ContextKind } from '@/engine/vfx-graph/document/effect-document';
import { IconButton } from '@/engine/ui/icon-button';
import { SearchField } from '@/engine/ui/search-field';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { visibleCenter } from './canvas/canvas-geometry';
import { STAGE_ACCENT_CLASS } from './stage-appearance';
import { useVfxGraph } from './use-vfx-graph';
const SEARCH_LOCALE = 'pt-BR';
const CASCADE_STEP = 18;
const CASCADE_LENGTH = 6;
const DROP_OFFSET_Y = 48;
function StageSection({ stage, blocks, onPlaceContext, onAddBlock }: {
    stage: ContextKind;
    blocks: readonly BlockDefinition[];
    onPlaceContext: () => void;
    onAddBlock: (type: string) => void;
}) {
    const { label } = CONTEXT_DEFINITIONS[stage];
    return (<section>
      <div className="flex items-center gap-1.5 pt-1.5 pr-1 pl-2">
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', STAGE_ACCENT_CLASS[stage])}/>
        <h3 className="min-w-0 flex-1 truncate text-3xs font-medium tracking-wider text-muted-foreground uppercase">{label}</h3>
        <IconButton label={`Adicionar contexto de ${label}`} size="xs" onClick={onPlaceContext}>
          <Plus aria-hidden/>
        </IconButton>
      </div>
      <ul>
        {blocks.map((definition) => (<li key={definition.type}>
            <button type="button" title={definition.description} onClick={() => onAddBlock(definition.type)} className={cn('flex h-6 w-full items-center pr-2 pl-5 text-left text-2xs text-foreground transition-colors duration-100 hover:bg-highlight', FOCUS_RING_CLASS)}>
              <span className="truncate">{definition.label}</span>
            </button>
          </li>))}
      </ul>
    </section>);
}
export function BlockLibraryPanel() {
    const editor = useVfxGraph();
    const [query, setQuery] = useState('');
    const graph = editor.document;
    if (!graph)
        return null;
    const needle = query.trim().toLocaleLowerCase(SEARCH_LOCALE);
    const sections = CONTEXT_KINDS.map((stage) => ({
        stage,
        blocks: blocksForStage(stage).filter((definition) => needle === '' || definition.label.toLocaleLowerCase(SEARCH_LOCALE).includes(needle)),
    })).filter((section) => needle === '' || section.blocks.length > 0);
    const placeContext = (stage: ContextKind) => {
        const center = visibleCenter(editor.view, editor.viewportSize);
        const cascade = (graph.contexts.length % CASCADE_LENGTH) * CASCADE_STEP;
        editor.addContext(stage, Math.round(center.x - CONTEXT_WIDTH / 2 + cascade), Math.round(center.y - DROP_OFFSET_Y + cascade));
    };
    const addBlock = (stage: ContextKind, type: string) => {
        if (!editor.contextForStage(stage))
            placeContext(stage);
        const target = editor.contextForStage(stage);
        if (target)
            editor.addBlock(target.id, type);
    };
    return (<aside aria-label="Biblioteca de blocos" className="flex w-52 shrink-0 flex-col border-r border-border bg-surface">
      <div className="shrink-0 p-1.5">
        <SearchField placeholder="Buscar bloco" value={query} onChange={setQuery}/>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {sections.length === 0 && <p className="px-2 py-3 text-3xs text-muted-foreground">Nenhum bloco com esse nome.</p>}
        {sections.map(({ stage, blocks }) => <StageSection key={stage} stage={stage} blocks={blocks} onPlaceContext={() => placeContext(stage)} onAddBlock={(type) => addBlock(stage, type)}/>)}
      </div>
    </aside>);
}
