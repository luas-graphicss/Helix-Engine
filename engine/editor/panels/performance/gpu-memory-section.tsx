'use client';
import { useSessionTopic, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MIN_BUDGET_MB = 32;
const MAX_BUDGET_MB = 2048;
const BUDGET_STEP_MB = 32;
const integer = (value: number) => value.toLocaleString('pt-BR');
const megabytes = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })} MB`;
export function GpuMemorySection() {
    const session = useSessionTopic('view');
    useViewportStats();
    const settings = session.render.optimization;
    const stats = session.optimizationStats;
    return (<CollapsibleSection title="Memória de GPU">
      <ToggleField label="Compactar vértices" hint="Normais e tangentes em 10 bits e coordenadas de textura em 16 bits; as malhas são reenviadas ao trocar" on={settings.meshCompression} onToggle={() => session.updateOptimization({ meshCompression: !settings.meshCompression })}/>
      <ToggleField label="Streaming de malhas" hint="Acima do orçamento, as malhas que não são desenhadas há mais tempo saem da GPU" on={settings.meshStreaming} onToggle={() => session.updateOptimization({ meshStreaming: !settings.meshStreaming })}/>
      <SliderField label="Orçamento" value={settings.meshBudgetMb} min={MIN_BUDGET_MB} max={MAX_BUDGET_MB} step={BUDGET_STEP_MB} scale="log" disabled={!settings.meshStreaming} format={megabytes} onChange={(value) => session.updateOptimization({ meshBudgetMb: value })}/>
      <PropertyRow label="Malhas">
        <span className="font-mono text-2xs text-foreground/80 tabular-nums">
          {megabytes(stats.meshBytes / BYTES_PER_MEGABYTE)}{' '}
          <span className="text-muted-foreground">
            · {integer(stats.meshesResident)} na GPU · {integer(stats.meshesReleased)} liberada(s)
          </span>
        </span>
      </PropertyRow>
    </CollapsibleSection>);
}
