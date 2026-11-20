'use client';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { NETWORK_PRESETS, matchingPreset, percentToRate, rateToPercent, type NetworkConditions } from '@/engine/net/transport/network-conditions';
import { applySimulatedConditions, readSimulatedConditions } from '@/engine/scripting/runtime/simulated-conditions';
import { ENGINE_SETTINGS } from '@/engine/settings/engine-settings-schema';
import { useEngineSettingsVersion } from '@/engine/settings/engine-settings-store';
import { SelectField } from '@/engine/ui/select-field';
import { NumberField } from '../shared/fields';
import { PanelSection, SectionNote, SettingRow } from '../shared/panel-section';
type ConditionField = {
    key: keyof NetworkConditions;
    label: string;
    fieldLabel: string;
    hint: string;
    max: number;
    step: number;
    isRate: boolean;
};
const CUSTOM_PRESET = 'custom';
const RATE_STEP = 0.1;
const PRESET_OPTIONS = [...NETWORK_PRESETS.map(({ id, label }) => ({ value: id, label })), { value: CUSTOM_PRESET, label: 'Personalizado' }];
const FIELDS: readonly ConditionField[] = [
    { key: 'latencyMs', label: 'Latência (ms)', fieldLabel: 'Latência simulada em milissegundos', hint: 'Atraso de ida de cada pacote.', max: ENGINE_SETTINGS['simulation.net.latency'].max, step: 5, isRate: false },
    { key: 'jitterMs', label: 'Variação (ms)', fieldLabel: 'Variação da latência em milissegundos', hint: 'Quanto a latência oscila de um pacote para outro, para mais e para menos.', max: ENGINE_SETTINGS['simulation.net.jitter'].max, step: 1, isRate: false },
    { key: 'lossRate', label: 'Perda (%)', fieldLabel: 'Perda de pacotes em porcento', hint: 'Pacotes que somem no caminho. Os canais confiáveis reenviam; a pose segue com o próximo estado.', max: ENGINE_SETTINGS['simulation.net.loss'].max, step: RATE_STEP, isRate: true },
    { key: 'duplicateRate', label: 'Duplicados (%)', fieldLabel: 'Pacotes duplicados em porcento', hint: 'Pacotes que chegam duas vezes. A engine descarta a cópia.', max: ENGINE_SETTINGS['simulation.net.duplicate'].max, step: RATE_STEP, isRate: true },
    { key: 'reorderRate', label: 'Fora de ordem (%)', fieldLabel: 'Pacotes fora de ordem em porcento', hint: 'Pacotes que atrasam e chegam depois de pacotes mais novos.', max: ENGINE_SETTINGS['simulation.net.reorder'].max, step: RATE_STEP, isRate: true },
];
function scopeNote(status: MultiplayerStatus): string {
    if (!status.active)
        return 'Vale a partir do próximo teste de jogo, no servidor simulado do editor.';
    return status.linkKind === 'hosted' ? 'Este teste está ligado ao servidor hospedado: a rede é a de verdade e estes valores não entram.' : 'Aplicado ao vivo na sessão em andamento.';
}
export function NetworkSimulatorSection({ status }: {
    status: MultiplayerStatus;
}) {
    const session = useEditorSession();
    useEngineSettingsVersion();
    const conditions = readSimulatedConditions();
    const apply = (patch: Partial<NetworkConditions>) => applySimulatedConditions(session.scripts.multiplayer, patch);
    return (<PanelSection title="Rede simulada" description="Degrada a ligação entre o jogo e o servidor simulado do editor, para testar como se fosse pela internet. É uma preferência desta máquina, não do projeto.">
      <SettingRow label="Perfil" hint="Conexões típicas prontas. Mexer num valor abaixo vira Personalizado.">
        <span className="flex w-40">
          <SelectField label="Perfil de rede simulada" options={PRESET_OPTIONS} value={matchingPreset(conditions)?.id ?? CUSTOM_PRESET} onChange={(id) => {
            const preset = NETWORK_PRESETS.find((candidate) => candidate.id === id);
            if (preset)
                apply(preset.conditions);
        }}/>
        </span>
      </SettingRow>
      {FIELDS.map(({ key, label, fieldLabel, hint, max, step, isRate }) => (<SettingRow key={key} label={label} hint={hint}>
          <NumberField label={fieldLabel} value={isRate ? rateToPercent(conditions[key]) : conditions[key]} min={0} max={max} step={step} onCommit={(value) => apply({ [key]: isRate ? percentToRate(value) : value })}/>
        </SettingRow>))}
      <SectionNote>{scopeNote(status)}</SectionNote>
    </PanelSection>);
}
