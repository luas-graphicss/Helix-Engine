'use client';
import { Plus, Trash2 } from 'lucide-react';
import { VFX_MAX_DURATION, VFX_MAX_PARTICLES_PER_EMITTER, type VfxDocument, type VfxEmitter, type VfxSimulationSpace } from '@/engine/vfx/document/vfx-document';
import { addVfxBurst, endVfxDocumentEdit, patchVfxBurst, patchVfxEmitter, patchVfxEmitterPart, removeVfxBurst, vfxMergeKey } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToggleField } from '@/engine/ui/toggle-field';
import { NumberRow } from '../fields/number-row';
import { ScalarField } from '../fields/scalar-field';
const SPACE_OPTIONS: ReadonlyArray<{
    value: VfxSimulationSpace;
    label: string;
}> = [
    { value: 'local', label: 'Local' },
    { value: 'world', label: 'Mundo' },
];
export function SpawnSection({ document, emitter }: {
    document: VfxDocument;
    emitter: VfxEmitter;
}) {
    const session = useEditorSession();
    const end = () => endVfxDocumentEdit(session);
    const key = (field: string) => vfxMergeKey(emitter.id, field);
    const patch = (patchValue: Partial<VfxEmitter>, label: string, field?: string) => patchVfxEmitter(session, emitter.id, patchValue, label, field ? key(field) : undefined);
    const { spawn } = emitter;
    return (<>
      <CollapsibleSection title="Emissor">
        <NumberRow label="Atraso" value={emitter.delay} min={0} max={VFX_MAX_DURATION} step={0.05} unit="s" onChange={(delay) => patch({ delay }, 'Atraso do emissor', 'delay')} onEnd={end}/>
        <NumberRow label="Duração" value={emitter.duration} min={0} max={VFX_MAX_DURATION} step={0.05} unit="s" onChange={(duration) => patch({ duration }, 'Duração do emissor', 'duration')} onEnd={end} trailing={<span className="shrink-0 text-3xs text-muted-foreground">{emitter.duration <= 0 ? 'ciclo inteiro' : `de ${document.duration.toFixed(1)} s`}</span>}/>
        <ToggleField label="Repete no laço" on={emitter.loop} onToggle={() => patch({ loop: !emitter.loop }, emitter.loop ? 'Emissor toca uma vez' : 'Emissor repete no laço')}/>
        <NumberRow label="Máx. partículas" value={emitter.maxParticles} min={1} max={VFX_MAX_PARTICLES_PER_EMITTER} step={10} precision={0} onChange={(maxParticles) => patch({ maxParticles }, 'Teto de partículas', 'maxParticles')} onEnd={end}/>
        <PropertyRow label="Espaço">
          <SegmentedControl label="Espaço de simulação" options={SPACE_OPTIONS} value={emitter.space} onChange={(space) => patch({ space }, `Emissor em espaço ${space === 'local' ? 'local' : 'de mundo'}`)}/>
        </PropertyRow>
      </CollapsibleSection>
      <CollapsibleSection title="Taxa">
        <ScalarField label="Por segundo" value={spawn.rate} unit="/s" min={0} step={1} precision={1} timeAxis="emitter" onChange={(rate) => patchVfxEmitterPart(session, emitter.id, 'spawn', { rate }, 'Taxa de emissão', key('rate'))} onEnd={end}/>
        <NumberRow label="Por metro" value={spawn.rateOverDistance} min={0} step={1} precision={1} unit="/m" onChange={(rateOverDistance) => patchVfxEmitterPart(session, emitter.id, 'spawn', { rateOverDistance }, 'Taxa por distância', key('rateOverDistance'))} onEnd={end}/>
      </CollapsibleSection>
      <CollapsibleSection title={`Rajadas (${spawn.bursts.length})`} trailing={<IconButton label="Adicionar rajada" size="xs" onClick={() => addVfxBurst(session, emitter.id, 0)}>
            <Plus />
          </IconButton>}>
        {spawn.bursts.length === 0 && (<ActionRow>
            <ActionButton icon={Plus} onClick={() => addVfxBurst(session, emitter.id, 0)}>
              Adicionar rajada
            </ActionButton>
          </ActionRow>)}
        {spawn.bursts.map((burst, index) => {
            const burstKey = (field: string) => vfxMergeKey(emitter.id, burst.id, field);
            const edit = (patchValue: Partial<typeof burst>, label: string, field: string) => patchVfxBurst(session, emitter.id, burst.id, patchValue, label, burstKey(field));
            return (<div key={burst.id} className="mx-2 flex flex-col gap-1 rounded-sm border border-border bg-surface-raised/40 p-1.5">
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-2xs font-medium text-foreground">Rajada {index + 1}</span>
                <IconButton label="Remover rajada" size="xs" className="hover:text-destructive" onClick={() => removeVfxBurst(session, emitter.id, burst.id)}>
                  <Trash2 />
                </IconButton>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <GuiNumberField label="Instante" value={burst.time} min={0} max={VFX_MAX_DURATION} step={0.05} unit="s" onChange={(time) => edit({ time }, 'Instante da rajada', 'time')} onEnd={end}/>
                <GuiNumberField label="Probabilidade" value={burst.probability * 100} min={0} max={100} step={5} precision={0} unit="%" onChange={(percent) => edit({ probability: percent / 100 }, 'Probabilidade da rajada', 'probability')} onEnd={end}/>
                <GuiNumberField label="Quantidade" value={burst.count} min={0} max={VFX_MAX_PARTICLES_PER_EMITTER} step={1} precision={0} unit="n" onChange={(count) => edit({ count }, 'Partículas da rajada', 'count')} onEnd={end}/>
                <GuiNumberField label="Quantidade máxima (0 = fixa)" value={burst.countMax} min={0} max={VFX_MAX_PARTICLES_PER_EMITTER} step={1} precision={0} unit="até" onChange={(countMax) => edit({ countMax }, 'Máximo da rajada', 'countMax')} onEnd={end}/>
                <GuiNumberField label="Repetições (0 = infinitas)" value={burst.cycles} min={0} max={1000} step={1} precision={0} unit="×" onChange={(cycles) => edit({ cycles }, 'Repetições da rajada', 'cycles')} onEnd={end}/>
                <GuiNumberField label="Intervalo entre repetições" value={burst.interval} min={0.01} max={VFX_MAX_DURATION} step={0.05} unit="s" onChange={(interval) => edit({ interval }, 'Intervalo da rajada', 'interval')} onEnd={end}/>
              </div>
            </div>);
        })}
      </CollapsibleSection>
    </>);
}
