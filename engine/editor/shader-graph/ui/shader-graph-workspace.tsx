'use client';
import { GraphCanvas } from './canvas/graph-canvas';
import { GraphEmptyState } from './graph-empty-state';
import { GraphSidePanel } from './graph-side-panel';
import { GraphStatusStrip } from './graph-status-strip';
import { GraphToolbar } from './graph-toolbar';
import { NodeLibraryPanel } from './node-library-panel';
import { useShaderGraph } from './use-shader-graph';
export function ShaderGraphWorkspace() {
    const editor = useShaderGraph();
    if (editor.status !== 'ready')
        return <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken text-2xs text-muted-foreground">Carregando grafos de shader…</div>;
    if (!editor.active)
        return <GraphEmptyState />;
    return (<div className="@container/workspace absolute inset-0 flex flex-col overflow-hidden bg-surface-sunken">
      <GraphToolbar />
      <div className="flex min-h-0 flex-1">
        <NodeLibraryPanel />
        <GraphCanvas key={editor.active.id}/>
        <GraphSidePanel />
      </div>
      <GraphStatusStrip />
    </div>);
}
