'use client';
import { Eraser, Route } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { removeNavSurface, setNavSurfaceCollect, setNavSurfaceDefaultArea, setNavSurfaceScalar, setNavSurfaceVolume } from '@/engine/editor/operations/navigation/nav-surface-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { NOT_WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import type { NavCollectMode, NavSurfaceScalar, NavSurfaceSettings } from '@/engine/navigation/surface/nav-surface-settings';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { NavAreaSelect } from './nav-area-select';
import { NAV_HINT_CLASS } from './nav-field-styles';
import { NavRemoveButton } from './nav-remove-button';
import { NavScalarRows, type NavScalarRow } from './nav-scalar-rows';
import { NavVectorRow } from './nav-vector-row';
const COLLECT_OPTIONS: ReadonlyArray<{
    value: NavCollectMode;
    label: string;
}> = [
    { value: 'scene', label: 'Cena' },
    { value: 'children', label: 'Filhos' },
    { value: 'volume', label: 'Volume' },
];
const COLLECT_HINT = 'Cena: toda a geometria parada. Filhos: só os atores dentro deste. Volume: só o que cabe na caixa';
const BAKE_ROWS: ReadonlyArray<NavScalarRow<NavSurfaceScalar>> = [
    { key: 'agentRadius', label: 'Raio', hint: 'Raio do agente: a malha se afasta das paredes nesta distância', suffix: ' m' },
    { key: 'agentHeight', label: 'Altura', hint: 'Altura do agente: vão livre mínimo para passar por baixo de algo', suffix: ' m' },
    { key: 'maxSlope', label: 'Rampa máxima', hint: 'Inclinação mais íngreme que ainda conta como caminhável', suffix: '°' },
    { key: 'stepHeight', label: 'Degrau', hint: 'Desnível que o agente sobe sem precisar de rampa', suffix: ' m' },
    { key: 'cellSize', label: 'Célula', hint: 'Tamanho do voxel: menor acompanha melhor a geometria e demora mais para gerar', suffix: ' m' },
    { key: 'minRegionArea', label: 'Região mínima', hint: 'Ilhas caminháveis menores que isto são descartadas', suffix: ' m²' },
];
function describePreview(session: EditorSession, entity: Entity): string {
    const report = session.navigation.previewOf(entity);
    if (!report)
        return 'Ainda não gerado';
    if (!report.mesh)
        return 'Sem área caminhável';
    return `${report.mesh.polygons.count.toLocaleString('pt-BR')} polígonos · ${report.mesh.walkableArea.toFixed(0)} m² · ${report.milliseconds.toFixed(0)} ms`;
}
export function NavSurfaceSection({ entity, settings }: {
    entity: Entity;
    settings: NavSurfaceSettings;
}) {
    const session = useEditorSession();
    const { navigation } = session;
    const preview = describePreview(session, entity);
    return (<CollapsibleSection title="NavMesh Surface" trailing={<NavRemoveButton label="Remover NavMesh Surface" onRemove={() => removeNavSurface(session, entity)}/>}>
      <ActionRow>
        <ActionButton icon={Route} variant="primary" onClick={() => navigation.bake(entity)}>
          Gerar NavMesh
        </ActionButton>
        {navigation.previewOf(entity) && (<ActionButton icon={Eraser} onClick={() => navigation.clear(entity)}>
            Limpar
          </ActionButton>)}
      </ActionRow>
      <PropertyRow label="Prévia">
        <FieldInput readOnly value={preview} title={preview} aria-label="Prévia do NavMesh gerado"/>
      </PropertyRow>
      <p className={NAV_HINT_CLASS}>
        {navigation.isStale(entity) ? 'Os valores mudaram depois da última geração: gere de novo para atualizar a prévia.' : 'A prévia serve para conferir a malha no editor. Ao simular, o NavMesh é gerado de novo com a cena do momento.'}
      </p>
      <PropertyRow label="Coleta" hint={COLLECT_HINT}>
        <SegmentedControl label="Geometria coletada pelo NavMesh" options={COLLECT_OPTIONS} value={settings.collect} onChange={(collect) => setNavSurfaceCollect(session, entity, collect)}/>
      </PropertyRow>
      {settings.collect === 'volume' && (<>
          <NavVectorRow label="Tamanho" name="Tamanho do volume do NavMesh" values={settings.volumeSize} onCommit={(axis, value) => setNavSurfaceVolume(session, entity, 'volumeSize', axis, value)}/>
          <NavVectorRow label="Centro" name="Centro do volume do NavMesh" values={settings.volumeCenter} onCommit={(axis, value) => setNavSurfaceVolume(session, entity, 'volumeCenter', axis, value)}/>
        </>)}
      <NavScalarRows rows={BAKE_ROWS} owner="do NavMesh" values={settings} onCommit={(key, value) => setNavSurfaceScalar(session, entity, key, value)}/>
      <PropertyRow label="Área padrão" hint="Área da geometria que nenhum modificador marcou">
        <NavAreaSelect label="Área padrão do NavMesh" value={settings.defaultArea} excluded={NOT_WALKABLE_AREA} onChange={(area) => setNavSurfaceDefaultArea(session, entity, area)}/>
      </PropertyRow>
    </CollapsibleSection>);
}
