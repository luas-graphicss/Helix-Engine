'use client';
import { Trash2 } from 'lucide-react';
import { CLOTH_PRESETS, findClothPreset } from '@/engine/cloth/cloth-presets';
import type { ClothQuality, ClothSettings } from '@/engine/cloth/cloth-settings';
import type { Entity } from '@/engine/core/scene/entity';
import { applyClothPreset, removeCloth, setClothAnchor, setClothQuality, setClothScalar } from '@/engine/editor/operations/cloth-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ClothAnchorField } from './cloth-anchor-field';
import { CLOTH_HINT_CLASS } from './cloth-field-styles';
const PERCENT = 100;
const PRESET_OPTIONS = CLOTH_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));
const QUALITY_OPTIONS: ReadonlyArray<{
    value: ClothQuality;
    label: string;
}> = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Média' },
    { value: 'high', label: 'Alta' },
];
function formatPercent(value: number): string {
    return `${Math.round(value)}%`;
}
function SimulationReadout({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const hint = useShortcutHint();
    const instance = session.clothWorld.system.instanceOf(entity);
    if (!instance)
        return <p className={CLOTH_HINT_CLASS}>Pressione {hint('Simular', 'simulation.playPause')} para ver o tecido se mover.</p>;
    const summary = `${instance.particleCount.toLocaleString('pt-BR')} partículas · ${instance.anchoredCount.toLocaleString('pt-BR')} presas · ${instance.constraintCount.toLocaleString('pt-BR')} restrições`;
    return (<PropertyRow label="Simulação">
      <FieldInput readOnly value={summary} title={summary} aria-label="Partículas e restrições do tecido"/>
    </PropertyRow>);
}
export function ClothSetupSection({ entity, settings }: {
    entity: Entity;
    settings: ClothSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Tecido" trailing={<IconButton label="Remover tecido" size="xs" className="hover:text-destructive" onClick={() => removeCloth(session, entity)}>
          <Trash2 />
        </IconButton>}>
      <PropertyRow label="Perfil" hint="Aplica um conjunto pronto de fixação, material e vento">
        <SegmentedControl label="Perfil do tecido" options={PRESET_OPTIONS} value={findClothPreset(settings)} onChange={(presetId) => applyClothPreset(session, entity, presetId)}/>
      </PropertyRow>
      <PropertyRow label="Fixação" hint="Borda que fica presa ao ator e o acompanha quando ele se move">
        <ClothAnchorField anchor={settings.anchor} onChange={(anchor) => setClothAnchor(session, entity, anchor)}/>
      </PropertyRow>
      {settings.anchor !== 'none' && (<SliderField label="Faixa presa" value={settings.anchorBand * PERCENT} min={0} max={50} step={1} format={formatPercent} onChange={(value) => setClothScalar(session, entity, 'anchorBand', value / PERCENT)}/>)}
      <PropertyRow label="Qualidade" hint="Subpassos por quadro: mais subpassos deixam o pano mais firme e custam mais">
        <SegmentedControl label="Qualidade da simulação" options={QUALITY_OPTIONS} value={settings.quality} onChange={(quality) => setClothQuality(session, entity, quality)}/>
      </PropertyRow>
      <SimulationReadout entity={entity}/>
    </CollapsibleSection>);
}
