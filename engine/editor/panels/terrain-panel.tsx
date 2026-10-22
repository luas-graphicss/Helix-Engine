'use client';
import { Locate, Mountain, Pickaxe, Plus } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { ActionButton } from '@/engine/ui/action-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addTerrain } from '@/engine/editor/operations/terrain-operations';
import type { Entity } from '@/engine/core/scene/entity';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { ToolsSection } from './terrain/tools-section';
import { LayersSection } from './terrain/layers-section';
import { GrassSection } from './terrain/grass-section';
import { WaterSection } from './terrain/water-section';
import { GenerationSection } from './terrain/generation-section';
import { ShadingSection } from './terrain/shading-section';
import { DimensionsSection } from './terrain/dimensions-section';
import { integer } from './terrain/formatters';
export interface TerrainTarget {
    entity: Entity;
    terrain: Terrain;
}
function NoTerrain() {
    const session = useEditorState();
    return (<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <Mountain className="size-5 opacity-60" aria-hidden/>
      <p className="text-2xs leading-relaxed text-pretty">Nenhum terreno na cena. Adicione um para esculpir, pintar camadas, plantar grama e colocar água.</p>
      <ActionButton icon={Plus} variant="primary" className="w-full max-w-48" onClick={() => addTerrain(session)}>
        Adicionar terreno
      </ActionButton>
    </div>);
}
export function TerrainPanel() {
    const session = useEditorState();
    const entity = session.terrain.target;
    const terrain = entity?.terrain;
    if (!entity || !terrain)
        return <NoTerrain />;
    const target: TerrainTarget = { entity, terrain };
    const sculpting = session.tool === 'terrain';
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <Mountain className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-semibold text-foreground">{entity.name}</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {integer(terrain.size)} m · {terrain.resolution}² vértices · {terrain.layers.length} camada{terrain.layers.length === 1 ? '' : 's'}
          </span>
        </div>
        <IconButton label="Enquadrar terreno" size="sm" onClick={() => session.focusEntity(entity)}>
          <Locate />
        </IconButton>
        <button type="button" aria-pressed={sculpting} title="Alterna o modo terreno: o pincel passa a agir no viewport (T)" onClick={() => session.setTool(sculpting ? 'select' : 'terrain')} className={sculpting
            ? 'flex h-6 items-center gap-1.5 rounded-sm bg-primary/15 px-2 text-2xs font-medium text-primary transition-colors hover:bg-primary/20'
            : 'flex h-6 items-center gap-1.5 rounded-sm border border-border px-2 text-2xs font-medium text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground'}>
          <Pickaxe className="size-3.5" aria-hidden/>
          {sculpting ? 'Editando' : 'Editar'}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <ToolsSection target={target}/>
        <LayersSection target={target}/>
        <GrassSection target={target}/>
        <WaterSection target={target}/>
        <GenerationSection target={target}/>
        <ShadingSection target={target}/>
        <DimensionsSection target={target}/>
      </div>
    </div>);
}
