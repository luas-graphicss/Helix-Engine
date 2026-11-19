'use client';
import { useState } from 'react';
import { NODE_CATEGORY_LABEL, PLACEABLE_CATEGORIES, placeableNodes } from '@/engine/shader-graph/nodes/node-catalog';
import { SearchField } from '@/engine/ui/search-field';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { NODE_WIDTH, visibleCenter } from './canvas/canvas-geometry';
import { CATEGORY_ACCENT_CLASS } from './node-appearance';
import { useShaderGraph } from './use-shader-graph';
const SEARCH_LOCALE = 'pt-BR';
const CASCADE_STEP = 18;
const CASCADE_LENGTH = 6;
const DROP_OFFSET_Y = 48;
export function NodeLibraryPanel() {
    const editor = useShaderGraph();
    const [query, setQuery] = useState('');
    const graph = editor.document;
    if (!graph)
        return null;
    const needle = query.trim().toLocaleLowerCase(SEARCH_LOCALE);
    const nodes = placeableNodes(graph.model).filter((definition) => needle === '' || definition.label.toLocaleLowerCase(SEARCH_LOCALE).includes(needle));
    const place = (type: string) => {
        const center = visibleCenter(editor.view, editor.viewportSize);
        const cascade = (graph.nodes.length % CASCADE_LENGTH) * CASCADE_STEP;
        editor.addNode(type, Math.round(center.x - NODE_WIDTH / 2 + cascade), Math.round(center.y - DROP_OFFSET_Y + cascade));
    };
    return (<aside aria-label="Biblioteca de nós" className="flex w-52 shrink-0 flex-col border-r border-border bg-surface">
      <div className="shrink-0 p-1.5">
        <SearchField placeholder="Buscar nó" value={query} onChange={setQuery}/>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {nodes.length === 0 && <p className="px-2 py-3 text-3xs text-muted-foreground">Nenhum nó com esse nome.</p>}
        {PLACEABLE_CATEGORIES.map((category) => {
            const items = nodes.filter((definition) => definition.category === category);
            if (items.length === 0)
                return null;
            return (<section key={category}>
              <h3 className="px-2 pt-2 pb-0.5 text-3xs font-medium tracking-wider text-muted-foreground uppercase">{NODE_CATEGORY_LABEL[category]}</h3>
              <ul>
                {items.map((definition) => (<li key={definition.type}>
                    <button type="button" title={definition.description} onClick={() => place(definition.type)} className={cn('flex h-6 w-full items-center gap-2 px-2 text-left text-2xs text-foreground transition-colors duration-100 hover:bg-highlight', FOCUS_RING_CLASS)}>
                      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', CATEGORY_ACCENT_CLASS[definition.category])}/>
                      <span className="truncate">{definition.label}</span>
                    </button>
                  </li>))}
              </ul>
            </section>);
        })}
      </div>
    </aside>);
}
