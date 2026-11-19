'use client';
import { BlockLibraryPanel } from './block-library-panel';
import { EffectCanvas } from './canvas/effect-canvas';
import { EffectEmptyState } from './effect-empty-state';
import { EffectSidePanel } from './effect-side-panel';
import { EffectStatusStrip } from './effect-status-strip';
import { EffectToolbar } from './effect-toolbar';
import { useVfxGraph } from './use-vfx-graph';
export function VfxGraphWorkspace() {
    const editor = useVfxGraph();
    if (editor.status !== 'ready')
        return <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken text-2xs text-muted-foreground">Carregando grafos de efeito…</div>;
    if (!editor.active)
        return <EffectEmptyState />;
    return (<div className="@container/workspace absolute inset-0 flex flex-col overflow-hidden bg-surface-sunken">
      <EffectToolbar />
      <div className="flex min-h-0 flex-1">
        <BlockLibraryPanel />
        <EffectCanvas key={editor.active.id}/>
        <EffectSidePanel />
      </div>
      <EffectStatusStrip />
    </div>);
}
