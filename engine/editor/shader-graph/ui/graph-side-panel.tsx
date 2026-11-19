'use client';
import { GraphPreviewView } from './graph-preview-view';
import { NodeProperties } from './node-properties';
export function GraphSidePanel() {
    return (<aside aria-label="Pré-visualização e propriedades do nó" className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <GraphPreviewView />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        <NodeProperties />
      </div>
    </aside>);
}
