'use client';
import { Scan } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { fitNavObstacleToMesh, removeNavObstacle, setNavObstacleFlag, setNavObstacleScalar, setNavObstacleShape, setNavObstacleVector } from '@/engine/editor/operations/navigation/nav-obstacle-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { NavObstacleScalar, NavObstacleSettings, NavObstacleShape } from '@/engine/navigation/obstacle/nav-obstacle-settings';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToggleField } from '@/engine/ui/toggle-field';
import { NavRemoveButton } from './nav-remove-button';
import { NavScalarRows, type NavScalarRow } from './nav-scalar-rows';
import { NavVectorRow } from './nav-vector-row';
const SHAPE_OPTIONS: ReadonlyArray<{
    value: NavObstacleShape;
    label: string;
}> = [
    { value: 'box', label: 'Caixa' },
    { value: 'capsule', label: 'Cápsula' },
];
const SIZE_HINT: Record<NavObstacleShape, string> = {
    box: 'Largura, altura e profundidade da caixa, antes da escala do ator',
    capsule: 'X é o diâmetro e Y a altura da cápsula, antes da escala do ator',
};
const STATIONARY_ROWS: ReadonlyArray<NavScalarRow<NavObstacleScalar>> = [
    { key: 'moveThreshold', label: 'Limiar', hint: 'Deslocamento a partir do qual o obstáculo conta como em movimento', suffix: ' m' },
    { key: 'timeToStationary', label: 'Espera', hint: 'Tempo parado antes de recortar a malha', suffix: ' s' },
];
export function NavObstacleSection({ entity, settings }: {
    entity: Entity;
    settings: NavObstacleSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="NavMesh Obstacle" trailing={<NavRemoveButton label="Remover NavMesh Obstacle" onRemove={() => removeNavObstacle(session, entity)}/>}>
      <PropertyRow label="Forma">
        <SegmentedControl label="Forma do obstáculo" options={SHAPE_OPTIONS} value={settings.shape} onChange={(shape) => setNavObstacleShape(session, entity, shape)}/>
      </PropertyRow>
      <NavVectorRow label="Centro" name="Centro do obstáculo" hint="Deslocamento a partir do pivô do ator" values={settings.center} onCommit={(axis, value) => setNavObstacleVector(session, entity, 'center', axis, value)}/>
      <NavVectorRow label="Tamanho" name="Tamanho do obstáculo" hint={SIZE_HINT[settings.shape]} values={settings.size} onCommit={(axis, value) => setNavObstacleVector(session, entity, 'size', axis, value)}/>
      {entity.mesh && (<ActionRow>
          <ActionButton icon={Scan} onClick={() => fitNavObstacleToMesh(session, entity)}>
            Ajustar à malha
          </ActionButton>
        </ActionRow>)}
      <ToggleField label="Recortar o NavMesh" hint="Abre um buraco na malha em volta do obstáculo, e os caminhos passam a contorná-lo. Desligado, os agentes só desviam dele" on={settings.carve} onToggle={() => setNavObstacleFlag(session, entity, 'carve', !settings.carve)}/>
      {settings.carve && <ToggleField label="Só quando parado" hint="Recorta depois que o obstáculo para; em movimento os agentes apenas desviam dele" on={settings.carveOnlyStationary} onToggle={() => setNavObstacleFlag(session, entity, 'carveOnlyStationary', !settings.carveOnlyStationary)}/>}
      {settings.carve && settings.carveOnlyStationary && <NavScalarRows rows={STATIONARY_ROWS} owner="do obstáculo" values={settings} onCommit={(key, value) => setNavObstacleScalar(session, entity, key, value)}/>}
    </CollapsibleSection>);
}
