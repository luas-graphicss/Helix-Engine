'use client';
import { Trash2 } from 'lucide-react';
import { removeInputBinding, setInputBindingInteraction, setInputBindingPath, setInputBindingProcessors, toggleInputBindingScheme } from '@/engine/editor/operations/input/input-binding-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_DEADZONE } from '@/engine/input/actions/binding-limits';
import type { InputAction, InputAsset, InputBinding } from '@/engine/input/actions/input-asset';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CheckBox } from '@/engine/ui/check-box';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { COMPOSITE_LABEL, INTERACTION_OPTIONS, partLabel } from '../input-labels';
import { ColumnNote } from '../shared/column';
import { ControlPathField } from './control-path-field';
const MAX_DURATION_SECONDS = 2;
const MAX_SCALE_SLIDER = 5;
const seconds = (value: number) => `${Number(value.toFixed(2))} s`;
const multiplier = (value: number) => `${Number(value.toFixed(2))}×`;
type BindingPropertiesProps = {
    asset: InputAsset;
    action: InputAction;
    binding: InputBinding;
    part: string | null;
};
export function BindingProperties({ asset, action, binding, part }: BindingPropertiesProps) {
    const session = useEditorSession();
    const { interaction, processors } = binding;
    const storedPart = binding.parts.find((candidate) => candidate.name === part);
    const isVector = action.type === 'vector2';
    return (<>
      {binding.composite !== null && !storedPart ? (<ColumnNote>{COMPOSITE_LABEL[binding.composite]}: selecione uma das partes para escolher o controle.</ColumnNote>) : (<CollapsibleSection title={storedPart ? `Controle · ${partLabel(storedPart.name)}` : 'Controle'}>
          <ControlPathField path={storedPart ? storedPart.path : binding.path} expected={storedPart ? 'button' : action.type} customLayouts={asset.customDevices} onChange={(path) => setInputBindingPath(session, binding.id, storedPart ? storedPart.name : null, path)}/>
        </CollapsibleSection>)}
      <CollapsibleSection title="Esquemas" hint="Sem nenhum marcado, o vínculo vale para todos os esquemas">
        {asset.schemes.map((scheme) => (<PropertyRow key={scheme.id} label={scheme.name}>
            <CheckBox checked={binding.schemes.includes(scheme.id)} label={`Usar no esquema ${scheme.name}`} onChange={() => toggleInputBindingScheme(session, binding, scheme.id)}/>
          </PropertyRow>))}
      </CollapsibleSection>
      <CollapsibleSection title="Interação">
        <PropertyRow label="Disparo">
          <SegmentedControl label="Interação do vínculo" options={INTERACTION_OPTIONS} value={interaction.kind} onChange={(kind) => setInputBindingInteraction(session, binding.id, { ...interaction, kind })}/>
        </PropertyRow>
        {interaction.kind !== 'press' && (<SliderField label="Duração" value={interaction.duration} min={0.05} max={MAX_DURATION_SECONDS} step={0.05} format={seconds} onChange={(duration) => setInputBindingInteraction(session, binding.id, { ...interaction, duration })}/>)}
      </CollapsibleSection>
      <CollapsibleSection title="Processadores" defaultOpen={false}>
        <SliderField label="Zona morta" value={processors.deadzone} min={0} max={MAX_DEADZONE} step={0.01} onChange={(deadzone) => setInputBindingProcessors(session, binding.id, { ...processors, deadzone })}/>
        <SliderField label="Escala" value={processors.scale} min={0.05} max={MAX_SCALE_SLIDER} step={0.05} format={multiplier} editable onChange={(scale) => setInputBindingProcessors(session, binding.id, { ...processors, scale })}/>
        <ToggleField label={isVector ? 'Inverter X' : 'Inverter'} on={processors.invertX} onToggle={() => setInputBindingProcessors(session, binding.id, { ...processors, invertX: !processors.invertX })}/>
        {isVector && <ToggleField label="Inverter Y" on={processors.invertY} onToggle={() => setInputBindingProcessors(session, binding.id, { ...processors, invertY: !processors.invertY })}/>}
      </CollapsibleSection>
      <ActionRow>
        <ActionButton icon={Trash2} variant="danger" onClick={() => removeInputBinding(session, binding.id)}>
          Excluir vínculo
        </ActionButton>
      </ActionRow>
    </>);
}
