'use client';
import { useState } from 'react';
import { Boxes, Gauge, Trash2 } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { clearStressTest, countStressActors, generateStressTest, STRESS_GROUP_NAME } from '@/engine/editor/operations/stress-test-operations';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { CPU_ONLY_STAGES, FRAME_STAGES, FRAME_STAGE_LABELS } from '@/engine/renderer/stats/frame-stages';
import { MAX_LOD_LEVELS } from '@/engine/renderer/lod/lod-chain';
import { TILE_LEVELS } from '@/engine/terrain/chunks/terrain-tiles';
const integer = (value: number) => value.toLocaleString('pt-BR');
const milliseconds = (value: number) => `${value.toFixed(2)} ms`;
const pixels = (value: number) => (value <= 0 ? 'Desligado' : `${value.toFixed(1)} px`);
const bias = (value: number) => (value === 0 ? 'Neutro' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`);
function Value({ children }: {
    children: React.ReactNode;
}) {
    return <span className="font-mono text-2xs text-foreground/80 tabular-nums">{children}</span>;
}
function Ratio({ part, total }: {
    part: number;
    total: number;
}) {
    const share = total > 0 ? Math.round((part / total) * 100) : 0;
    return (<Value>
      {integer(part)} <span className="text-muted-foreground">/ {integer(total)} · {share}%</span>
    </Value>);
}
function PerLevel({ counts, levels }: {
    counts: ArrayLike<number>;
    levels: number;
}) {
    const chips: React.ReactNode[] = [];
    for (let level = 0; level < levels; level++) {
        chips.push(<span key={level} className="rounded-sm bg-surface-raised px-1 font-mono text-[10px] leading-4 text-foreground/80 tabular-nums">
        <span className="text-muted-foreground">L{level}</span> {integer(counts[level])}
      </span>);
    }
    return <div className="flex flex-wrap gap-1 py-1">{chips}</div>;
}
export function PerformancePanel() {
    const session = useEditorState();
    const { stats, render } = session;
    const { culling, lod } = render;
    const gpu = stats.gpuStageMs;
    const cpuTotal = stats.cpuStageMs.reduce((sum, value) => sum + value, 0);
    const frameMs = stats.fps > 0 ? 1000 / stats.fps : 0;
    const slowest = Math.max(cpuTotal, stats.gpuMs, 0.001);
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <Gauge className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-foreground">Desempenho do viewport</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {stats.fps} fps · {frameMs.toFixed(1)} ms/frame · {stats.width} × {stats.height}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <CollapsibleSection title="Tempo por etapa">
          <div className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-x-2 px-2 pb-1 text-2xs text-muted-foreground">
            <span />
            <span className="text-right">CPU</span>
            <span className="text-right">GPU</span>
          </div>
          <ul className="flex flex-col gap-1 px-2 pb-2">
            {FRAME_STAGES.map((stage, index) => {
            const cpu = stats.cpuStageMs[index];
            const gpuMs = gpu && !CPU_ONLY_STAGES.has(stage) ? gpu[index] : null;
            const width = Math.min(100, (Math.max(cpu, gpuMs ?? 0) / slowest) * 100);
            return (<li key={stage} className="flex flex-col gap-0.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-x-2">
                    <span className="truncate text-2xs text-foreground/80">{FRAME_STAGE_LABELS[stage]}</span>
                    <span className="text-right font-mono text-2xs text-foreground/80 tabular-nums">{cpu.toFixed(2)}</span>
                    <span className="text-right font-mono text-2xs text-foreground/80 tabular-nums">{gpuMs === null ? '—' : gpuMs.toFixed(2)}</span>
                  </div>
                  <div className="h-0.5 w-full rounded-full bg-surface-raised" aria-hidden>
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }}/>
                  </div>
                </li>);
        })}
          </ul>
          <PropertyRow label="Total CPU">
            <Value>{milliseconds(cpuTotal)}</Value>
          </PropertyRow>
          <PropertyRow label="Total GPU">
            <Value>{gpu ? milliseconds(stats.gpuMs) : 'Sem timer queries neste browser'}</Value>
          </PropertyRow>
          <PropertyRow label="Draw calls">
            <Value>
              {integer(stats.drawCalls)} <span className="text-muted-foreground">· {integer(stats.triangles)} tris</span>
            </Value>
          </PropertyRow>
        </CollapsibleSection>

        <CollapsibleSection title="Culling">
          <ToggleField label="Frustum" on={culling.frustumCulling} onToggle={() => session.toggleFrustumCulling()}/>
          <SliderField label="Tamanho mín." value={culling.minPixelSize} min={0} max={12} step={0.5} format={pixels} onChange={(value) => session.updateCulling({ minPixelSize: value })}/>
          <PropertyRow label="Visíveis">
            <Ratio part={stats.meshesVisible} total={stats.meshCandidates}/>
          </PropertyRow>
          <PropertyRow label="Fora do frustum">
            <Value>{integer(stats.frustumCulled)}</Value>
          </PropertyRow>
          <PropertyRow label="Pequenas demais">
            <Value>{integer(stats.sizeCulled)}</Value>
          </PropertyRow>
          <PropertyRow label="Chunks">
            <Value>
              {integer(stats.chunks)} <span className="text-muted-foreground">· {integer(stats.chunksCulled)} descartados inteiros</span>
            </Value>
          </PropertyRow>
        </CollapsibleSection>

        <CollapsibleSection title="Nível de detalhe">
          <ToggleField label="LOD" on={lod.enabled} onToggle={() => session.updateLod({ enabled: !lod.enabled })}/>
          <SliderField label="Viés" value={lod.bias} min={-2} max={2} step={0.25} disabled={!lod.enabled} format={bias} onChange={(value) => session.updateLod({ bias: value })}/>
          <PropertyRow label="Malhas">
            <PerLevel counts={stats.lodPerLevel} levels={MAX_LOD_LEVELS}/>
          </PropertyRow>
          <PropertyRow label="Gerando">
            <Value>{stats.lodPending > 0 ? `${integer(stats.lodPending)} cadeia(s)` : 'Nenhuma'}</Value>
          </PropertyRow>
          <PropertyRow label="Tiles">
            <PerLevel counts={stats.terrainPerLevel} levels={TILE_LEVELS}/>
          </PropertyRow>
        </CollapsibleSection>

        <CollapsibleSection title="Lotes e sombras">
          <ToggleField label="Sombras" on={session.shadowsEnabled} onToggle={() => session.toggleShadows()}/>
          <PropertyRow label="Instâncias">
            <Value>
              {integer(stats.instances)} <span className="text-muted-foreground">em {integer(stats.batches)} lote(s)</span>
            </Value>
          </PropertyRow>
          <PropertyRow label="Sombras">
            <Value>
              {integer(stats.shadowDrawCalls)} draws <span className="text-muted-foreground">· {integer(stats.shadowTriangles)} tris</span>
            </Value>
          </PropertyRow>
          <PropertyRow label="Terreno">
            <Value>
              {integer(stats.terrainTilesDrawn)}/{integer(stats.terrainTiles)} tiles{' '}
              <span className="text-muted-foreground">
                · {integer(stats.terrainDrawCalls)} draws · {integer(stats.terrainTriangles)} tris
              </span>
            </Value>
          </PropertyRow>
          {stats.cloudWidth > 0 && (<PropertyRow label="Nuvens">
              <Value>
                {stats.cloudWidth} × {stats.cloudHeight}
              </Value>
            </PropertyRow>)}
        </CollapsibleSection>

        <StressTestSection />
      </div>
    </div>);
}
const STRESS_MIN = 500;
const STRESS_MAX = 30000;
const STRESS_STEP = 500;
const STRESS_DEFAULT = 5000;
function StressTestSection() {
    const session = useEditorState();
    const [count, setCount] = useState(STRESS_DEFAULT);
    const current = countStressActors(session);
    return (<CollapsibleSection title="Teste de estresse">
      <SliderField label="Atores" value={count} min={STRESS_MIN} max={STRESS_MAX} step={STRESS_STEP} format={integer} onChange={setCount}/>
      <PropertyRow label="Na cena">
        <Value>{current > 0 ? `${integer(current)} no grupo "${STRESS_GROUP_NAME}"` : 'Nenhum'}</Value>
      </PropertyRow>
      <div className="flex gap-1.5 px-2 py-1">
        <button type="button" onClick={() => generateStressTest(session, count)} className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm border border-dashed border-border-strong text-2xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-highlight">
          <Boxes className="size-3.5 text-primary" aria-hidden/>
          Gerar {integer(count)}
        </button>
        <button type="button" onClick={() => clearStressTest(session)} disabled={current === 0} className="flex h-7 items-center justify-center gap-1.5 rounded-sm border border-border px-2.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground disabled:cursor-default disabled:opacity-40">
          <Trash2 className="size-3.5" aria-hidden/>
          Limpar
        </button>
      </div>
      <p className="px-2 pb-2 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Seis malhas compartilhadas, cores e escalas variadas, apoiadas no terreno. Fora do histórico de desfazer: remova pelo botão.
      </p>
    </CollapsibleSection>);
}
