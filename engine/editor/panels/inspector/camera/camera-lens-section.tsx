'use client';
import { Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import type { CameraProjection, CameraRole, CameraSettings } from '@/engine/camera/camera-settings';
import { removeCameraComponent, setCameraValue } from '@/engine/editor/operations/camera-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ScalarField } from '../number-fields';
const ROLE_OPTIONS: ReadonlyArray<{
    value: CameraRole;
    label: string;
}> = [
    { value: 'base', label: 'Base' },
    { value: 'overlay', label: 'Sobreposição' },
];
const PROJECTION_OPTIONS: ReadonlyArray<{
    value: CameraProjection;
    label: string;
}> = [
    { value: 'perspective', label: 'Perspectiva' },
    { value: 'orthographic', label: 'Ortográfica' },
];
const FIELD_OF_VIEW_RANGE = { min: 10, max: 120 };
const ORTHOGRAPHIC_SIZE_RANGE = { min: 0.1, max: 200 };
export function CameraLensSection({ entity, settings }: {
    entity: Entity;
    settings: CameraSettings;
}) {
    const session = useEditorSession();
    const commit = (key: 'near' | 'far', value: number) => {
        if (Number.isFinite(value))
            setCameraValue(session, entity, key, value);
    };
    return (<CollapsibleSection title="Câmera" trailing={<IconButton label="Remover componente de câmera" size="xs" className="hover:text-destructive" onClick={() => removeCameraComponent(session, entity)}>
          <Trash2 />
        </IconButton>}>
      <ToggleField label="Ativa" hint="Câmeras inativas não desenham nem atualizam a textura" on={settings.enabled} onToggle={() => setCameraValue(session, entity, 'enabled', !settings.enabled)}/>
      <PropertyRow label="Função" hint="Base desenha a cena inteira; sobreposição desenha por cima de uma base">
        <SegmentedControl label="Função da câmera" options={ROLE_OPTIONS} value={settings.role} onChange={(role) => setCameraValue(session, entity, 'role', role)}/>
      </PropertyRow>
      <PropertyRow label="Projeção">
        <SegmentedControl label="Projeção" options={PROJECTION_OPTIONS} value={settings.projection} onChange={(projection) => setCameraValue(session, entity, 'projection', projection)}/>
      </PropertyRow>
      {settings.projection === 'perspective' ? (<SliderField label="Campo de visão" value={settings.fieldOfView} min={FIELD_OF_VIEW_RANGE.min} max={FIELD_OF_VIEW_RANGE.max} step={1} suffix="°" editable onChange={(value) => setCameraValue(session, entity, 'fieldOfView', value)}/>) : (<SliderField label="Meia altura" value={settings.orthographicSize} min={ORTHOGRAPHIC_SIZE_RANGE.min} max={ORTHOGRAPHIC_SIZE_RANGE.max} scale="log" suffix=" m" editable onChange={(value) => setCameraValue(session, entity, 'orthographicSize', value)}/>)}
      <PropertyRow label="Plano próximo" hint="Nada mais perto que isto é desenhado">
        <ScalarField label="Plano próximo" value={settings.near} suffix=" m" onCommit={(value) => commit('near', value)}/>
      </PropertyRow>
      <PropertyRow label="Plano distante" hint="Nada mais longe que isto é desenhado">
        <ScalarField label="Plano distante" value={settings.far} suffix=" m" onCommit={(value) => commit('far', value)}/>
      </PropertyRow>
    </CollapsibleSection>);
}
