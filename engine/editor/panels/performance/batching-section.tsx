'use client';
import { useSessionTopic, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField } from '@/engine/ui/toggle-field';
const integer = (value: number) => value.toLocaleString('pt-BR');
function Merged({ meshes, batches }: {
    meshes: number;
    batches: number;
}) {
    return (<span className="font-mono text-2xs text-foreground/80 tabular-nums">
      {integer(meshes)} <span className="text-muted-foreground">malha(s) em {integer(batches)} lote(s)</span>
    </span>);
}
export function BatchingSection() {
    const session = useSessionTopic('view');
    const frame = useViewportStats();
    const settings = session.render.optimization;
    const stats = session.optimizationStats;
    return (<CollapsibleSection title="Lotes de desenho">
      <ToggleField label="Estáticos" hint="Funde malhas pequenas paradas que usam o mesmo material, por região" on={settings.staticBatching} onToggle={() => session.updateOptimization({ staticBatching: !settings.staticBatching })}/>
      <ToggleField label="Dinâmicos" hint="Junta na CPU, a cada quadro, malhas de até 256 vértices com o mesmo material" on={settings.dynamicBatching} onToggle={() => session.updateOptimization({ dynamicBatching: !settings.dynamicBatching })}/>
      <ToggleField label="Por shader" hint="Ordena os lotes pela variante de shader antes do material (SRP Batcher)" on={settings.shaderBatching} onToggle={() => session.updateOptimization({ shaderBatching: !settings.shaderBatching })}/>
      <PropertyRow label="Estáticos">
        <Merged meshes={stats.staticBatchedMeshes} batches={stats.staticBatches}/>
      </PropertyRow>
      <PropertyRow label="Dinâmicos">
        <Merged meshes={stats.dynamicBatchedMeshes} batches={stats.dynamicBatches}/>
      </PropertyRow>
      <PropertyRow label="Instanciados" hint="Malhas iguais com o mesmo material saem juntas, uma instância cada">
        <span className="font-mono text-2xs text-foreground/80 tabular-nums">
          {integer(frame.instances)} <span className="text-muted-foreground">instância(s) em {integer(frame.batches)} lote(s)</span>
        </span>
      </PropertyRow>
      <PropertyRow label="Trocas" hint="Trocas de programa e de material ao desenhar as malhas, somadas no quadro">
        <span className="font-mono text-2xs text-foreground/80 tabular-nums">
          {integer(stats.shaderSwitches)} <span className="text-muted-foreground">de shader · {integer(stats.materialSwitches)} de material</span>
        </span>
      </PropertyRow>
    </CollapsibleSection>);
}
