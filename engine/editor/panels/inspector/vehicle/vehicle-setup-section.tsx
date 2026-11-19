'use client';
import { Plus, Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addWheelActor } from '@/engine/editor/operations/wheel-operations';
import { applyVehiclePreset, removeVehicle, setVehicleControl } from '@/engine/editor/operations/vehicle-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { REVERSE_GEAR } from '@/engine/vehicle/drivetrain/gearbox';
import { collectVehicleWheels } from '@/engine/vehicle/vehicle-hierarchy';
import { findVehiclePreset, VEHICLE_PRESETS } from '@/engine/vehicle/vehicle-presets';
import type { VehicleControl, VehicleSettings } from '@/engine/vehicle/vehicle-settings';
import { useLiveReadout } from '../use-live-readout';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { formatWhole } from './vehicle-formats';
const METERS_PER_SECOND_TO_KMH = 3.6;
const PRESET_OPTIONS = VEHICLE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));
const CONTROL_OPTIONS: ReadonlyArray<{
    value: VehicleControl;
    label: string;
}> = [
    { value: 'player', label: 'Jogador' },
    { value: 'script', label: 'Script' },
];
function countLabel(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}
function describeWheels(entity: Entity): string {
    const wheels = collectVehicleWheels(entity);
    const driven = wheels.filter((wheel) => wheel.wheel?.driven).length;
    const steering = wheels.filter((wheel) => wheel.wheel?.steering).length;
    return `${countLabel(wheels.length, 'roda', 'rodas')} · ${driven} de tração · ${countLabel(steering, 'direcional', 'direcionais')}`;
}
function describeDashboard(session: EditorSession, entity: Entity): string | null {
    const vehicle = session.playtest.vehicles?.system.instanceOf(entity);
    if (!vehicle)
        return null;
    const gear = vehicle.gear === REVERSE_GEAR ? 'ré' : `${vehicle.gear}ª`;
    return `${formatWhole(vehicle.speed * METERS_PER_SECOND_TO_KMH)} km/h · ${gear} · ${formatWhole(vehicle.engineRpm)} rpm`;
}
function Dashboard({ entity }: {
    entity: Entity;
}) {
    const hint = useShortcutHint();
    const dashboard = useLiveReadout(entity, describeDashboard);
    if (!dashboard)
        return <p className={VEHICLE_HINT_CLASS}>Pressione {hint('Simular', 'simulation.playPause')} para dirigir.</p>;
    return (<PropertyRow label="Painel">
      <FieldInput readOnly value={dashboard} aria-label="Velocidade, marcha e giro do motor"/>
    </PropertyRow>);
}
export function VehicleSetupSection({ entity, settings }: {
    entity: Entity;
    settings: VehicleSettings;
}) {
    const session = useEditorSession();
    const wheels = describeWheels(entity);
    return (<CollapsibleSection title="Veículo" trailing={<IconButton label="Remover veículo" size="xs" className="hover:text-destructive" onClick={() => removeVehicle(session, entity)}>
          <Trash2 />
        </IconButton>}>
      <PropertyRow label="Perfil" hint="Aplica motor, câmbio, direção e freios de um veículo pronto; as rodas não mudam">
        <SegmentedControl label="Perfil do veículo" options={PRESET_OPTIONS} value={findVehiclePreset(settings)} onChange={(presetId) => applyVehiclePreset(session, entity, presetId)}/>
      </PropertyRow>
      <PropertyRow label="Controle" hint="Jogador: W e S aceleram e freiam, A e D viram, Espaço é o freio de mão. Script: só helix.vehicle comanda">
        <SegmentedControl label="Quem dirige o veículo" options={CONTROL_OPTIONS} value={settings.control} onChange={(control) => setVehicleControl(session, entity, control)}/>
      </PropertyRow>
      <PropertyRow label="Rodas">
        <FieldInput readOnly value={wheels} title={wheels} aria-label="Rodas do veículo"/>
      </PropertyRow>
      <ActionRow>
        <ActionButton icon={Plus} onClick={() => addWheelActor(session, entity)}>
          Adicionar roda
        </ActionButton>
      </ActionRow>
      <Dashboard entity={entity}/>
    </CollapsibleSection>);
}
