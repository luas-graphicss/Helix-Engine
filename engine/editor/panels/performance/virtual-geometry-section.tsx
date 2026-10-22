'use client';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { useEditorState, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { MAX_PIXEL_ERROR, MIN_PIXEL_ERROR, MYRIAD_DEBUG_VIEW_LABELS, MYRIAD_DEBUG_VIEWS, type MyriadDebugView } from '@/engine/renderer/myriad/runtime/myriad-settings';
import { CLUSTER_MAX_TRIANGLES } from '@/engine/renderer/myriad/data/myriad-limits';
const integer = (value: number) => value.toLocaleString('pt-BR');
const pixelError = (value: number) => `${value.toFixed(2)} px`;
const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
function Value({ children }: {
    children: React.ReactNode;
}) {
    return <span className="font-mono text-2xs text-foreground/80 tabular-nums">{children}</span>;
}
function Muted({ children }: {
    children: React.ReactNode;
}) {
    return <span className="text-muted-foreground">{children}</span>;
}
function LevelChips({ counts }: {
    counts: Uint32Array;
}) {
    const chips: React.ReactNode[] = [];
    for (let level = 0; level < counts.length; level++) {
        if (counts[level] === 0)
            continue;
        chips.push(<span key={level} className="rounded-sm bg-surface-raised px-1 font-mono text-[10px] leading-4 text-foreground/80 tabular-nums">
        <span className="text-muted-foreground">L{level}</span> {integer(counts[level])}
      </span>);
    }
    if (chips.length === 0)
        return <Value>—</Value>;
    return <div className="flex flex-wrap gap-1 py-1">{chips}</div>;
}
export function VirtualGeometrySection() {
    const session = useEditorState();
    const { myriad } = session.render;
    const stats = useViewportStats().myriad;
    const disabled = !myriad.enabled;
    const culled = Math.max(stats.occlusionEntries - stats.occlusionMainVisible - stats.occlusionPostVisible, 0);
    const culledShare = stats.occlusionEntries > 0 ? Math.round((culled / stats.occlusionEntries) * 100) : 0;
    const rasterCapacity = stats.clusters * CLUSTER_MAX_TRIANGLES;
    const fill = rasterCapacity > 0 ? Math.round((stats.triangles / rasterCapacity) * 100) : 0;
    const trisPerPixel = stats.width > 0 && stats.height > 0 ? stats.triangles / (stats.width * stats.height) : 0;
    return (<CollapsibleSection title="Geometria virtual">
      <ToggleField label="Ativa" on={myriad.enabled} onToggle={() => session.updateMyriad({ enabled: !myriad.enabled })}/>
      <SliderField label="Erro em tela" value={myriad.pixelError} min={MIN_PIXEL_ERROR} max={MAX_PIXEL_ERROR} step={0.25} disabled={disabled} format={pixelError} onChange={(value) => session.updateMyriad({ pixelError: value })}/>
      <PropertyRow label="Visualização">
        <select aria-label="Visualização da geometria virtual" value={myriad.debugView} disabled={disabled} onChange={(event) => session.updateMyriad({ debugView: event.currentTarget.value as MyriadDebugView })} className="h-6 min-w-0 flex-1 rounded-sm border border-border bg-input px-1 font-mono text-2xs text-foreground outline-none focus-visible:border-primary/70 disabled:opacity-40">
          {MYRIAD_DEBUG_VIEWS.map((view) => (<option key={view} value={view}>
              {MYRIAD_DEBUG_VIEW_LABELS[view]}
            </option>))}
        </select>
      </PropertyRow>
      {myriad.debugView === 'hzb' && (<SliderField label="Nível da pirâmide" value={myriad.hzbLevel} min={0} max={10} step={1} format={(value) => `mip ${value}`} onChange={(value) => session.updateMyriad({ hzbLevel: value })}/>)}
      <ToggleField label={stats.occlusionSupported ? 'Culling de oclusão' : 'Oclusão (sem suporte)'} on={myriad.occlusionCulling && stats.occlusionSupported} onToggle={disabled || !stats.occlusionSupported ? undefined : () => session.updateMyriad({ occlusionCulling: !myriad.occlusionCulling })}/>
      <ToggleField label="Sombras por cluster" on={myriad.shadowClusters} onToggle={disabled ? undefined : () => session.updateMyriad({ shadowClusters: !myriad.shadowClusters })}/>
      <ToggleField label="Arestas" on={myriad.wireframe} onToggle={disabled ? undefined : () => session.updateMyriad({ wireframe: !myriad.wireframe })}/>
      <ToggleField label="Congelar" on={myriad.freeze} onToggle={disabled ? undefined : () => session.updateMyriad({ freeze: !myriad.freeze })}/>

      <PropertyRow label="Orçamento">
        <Value>
          {stats.active ? 'Em uso' : 'Em espera'}{' '}
          <Muted>
            · {integer(stats.classicTriangles)} / {integer(stats.activationTriangles)} tris densos
          </Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Instâncias">
        <Value>
          {integer(stats.instances)} <Muted>· {integer(stats.materialStates)} estado(s) de material</Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Clusters">
        <Value>
          {integer(stats.clusters)} <Muted>· {integer(stats.triangles)} tris · {fill}% cheios</Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Por nível">
        <LevelChips counts={stats.perLevel}/>
      </PropertyRow>
      <PropertyRow label="Densidade">
        <Value>
          {trisPerPixel.toFixed(2)} <Muted>tris/pixel · {stats.width} × {stats.height}</Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Frustum (DAG)">
        <Value>
          {integer(stats.frustumCulled)} <Muted>podados · {integer(stats.groupsVisited)} grupos refinados</Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Oclusão">
        <Value>
          {stats.occlusionActive ? (<>
              {integer(culled)} <Muted>ocultos · {culledShare}% · {integer(stats.occlusionPostVisible)} no pós-passe</Muted>
            </>) : (<Muted>{stats.occlusionSupported ? 'Inativa neste frame' : 'Sem EXT_color_buffer_float'}</Muted>)}
        </Value>
      </PropertyRow>
      <PropertyRow label="Sombras">
        <Value>
          {integer(stats.shadowClusters)} <Muted>clusters · {integer(stats.shadowTriangles)} tris</Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Pool na GPU">
        <Value>
          {megabytes(stats.poolBytes)} <Muted>· {integer(stats.poolClusters)} clusters · {integer(stats.poolMeshes)} malha(s)</Muted>
        </Value>
      </PropertyRow>
      <PropertyRow label="Construção">
        <Value>
          {stats.buildPending > 0 ? (<>
              {integer(stats.buildPending)}{' '}
              <Muted>
                na fila{stats.building ? ` · ${stats.building}` : ''}
                {stats.waiting > 0 ? ` · ${integer(stats.waiting)} instância(s) aguardando` : ''}
              </Muted>
            </>) : (<>
              {integer(stats.buildReady)} <Muted>prontas{stats.buildFailed > 0 ? ` · ${integer(stats.buildFailed)} falha(s)` : ''}</Muted>
            </>)}
        </Value>
      </PropertyRow>
      <PropertyRow label="Passes">
        <Value>
          {integer(stats.drawCalls)} <Muted>draws (culling, raster, pirâmide, resolve)</Muted>
        </Value>
      </PropertyRow>
    </CollapsibleSection>);
}
