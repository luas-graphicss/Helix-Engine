'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { removeNavAgent, setNavAgentArea, setNavAgentAutoBraking, setNavAgentAvoidance, setNavAgentScalar, setNavAgentTarget } from '@/engine/editor/operations/navigation/nav-agent-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import type { NavAgentScalar, NavAgentSettings, NavAvoidanceQuality } from '@/engine/navigation/agent/nav-agent-settings';
import { areaBit, NOT_WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { CheckBox } from '@/engine/ui/check-box';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { formatNumber } from '../number-fields';
import { useLiveReadout } from '../use-live-readout';
import { NAV_HINT_CLASS } from './nav-field-styles';
import { NavRemoveButton } from './nav-remove-button';
import { NavScalarRows, type NavScalarRow } from './nav-scalar-rows';
const NO_TARGET = -1;
const MOVEMENT_ROWS: ReadonlyArray<NavScalarRow<NavAgentScalar>> = [
    { key: 'speed', label: 'Velocidade', hint: 'Velocidade máxima ao seguir o caminho', suffix: ' m/s' },
    { key: 'angularSpeed', label: 'Giro', hint: 'Quão rápido o agente vira para onde está andando', suffix: ' °/s' },
    { key: 'acceleration', label: 'Aceleração', hint: 'Quão rápido o agente ganha e perde velocidade', suffix: ' m/s²' },
    { key: 'stoppingDistance', label: 'Parada', hint: 'Distância do destino em que o agente se dá por chegado', suffix: ' m' },
];
const SHAPE_ROWS: ReadonlyArray<NavScalarRow<NavAgentScalar>> = [
    { key: 'radius', label: 'Raio', hint: 'Raio usado para desviar de outros agentes e de obstáculos', suffix: ' m' },
    { key: 'height', label: 'Altura', hint: 'Altura do cilindro do agente', suffix: ' m' },
    { key: 'baseOffset', label: 'Base', hint: 'Distância do pivô do ator até os pés, que ficam sobre o NavMesh', suffix: ' m' },
];
const PRIORITY_ROWS: ReadonlyArray<NavScalarRow<NavAgentScalar>> = [
    { key: 'avoidancePriority', label: 'Prioridade', hint: 'De 0 a 99: quem tem o número menor passa na frente e os outros desviam', suffix: '' },
];
const AVOIDANCE_OPTIONS: ReadonlyArray<{
    value: NavAvoidanceQuality;
    label: string;
}> = [
    { value: 'none', label: 'Nenhum' },
    { value: 'low', label: 'Baixo' },
    { value: 'medium', label: 'Médio' },
    { value: 'high', label: 'Alto' },
];
function describeAgent(session: EditorSession, entity: Entity): string | null {
    const agent = session.playtest.navigation?.agentOf(entity);
    if (!agent)
        return null;
    if (agent.isOnLink)
        return 'Atravessando um link';
    if (!agent.isOnNavMesh)
        return 'Fora do NavMesh';
    if (agent.hasArrived)
        return 'Chegou ao destino';
    if (!agent.hasDestination)
        return 'Parado, sem destino';
    if (agent.path?.status === 'invalid')
        return 'Sem caminho até o destino';
    const reach = agent.path?.status === 'partial' ? ' · caminho parcial' : '';
    return `Andando · faltam ${formatNumber(agent.remainingDistance, 1)} m${reach}`;
}
function AgentReadout({ entity }: {
    entity: Entity;
}) {
    const hint = useShortcutHint();
    const state = useLiveReadout(entity, describeAgent);
    if (!state)
        return <p className={NAV_HINT_CLASS}>Pressione {hint('Simular', 'simulation.playPause')} para o agente andar até o destino.</p>;
    return (<PropertyRow label="Estado">
      <FieldInput readOnly value={state} title={state} aria-label="Estado do agente na simulação"/>
    </PropertyRow>);
}
function TargetField({ entity, settings }: {
    entity: Entity;
    settings: NavAgentSettings;
}) {
    const session = useEditorSession();
    const candidates = session.scene.entities.filter((candidate) => candidate !== entity && candidate.kind !== 'script');
    const options = [{ value: NO_TARGET, label: 'Nenhum (definido por script)' }, ...candidates.map((candidate) => ({ value: candidate.id, label: candidate.name }))];
    const target = candidates.find((candidate) => candidate.id === settings.target)?.id ?? NO_TARGET;
    return (<PropertyRow label="Destino" hint="Ator que o agente persegue: o caminho é refeito sempre que ele se move">
      <SelectField label="Destino do agente" options={options} value={target} onChange={(target) => setNavAgentTarget(session, entity, target === NO_TARGET ? null : target)}/>
    </PropertyRow>);
}
function AreaMaskField({ entity, settings }: {
    entity: Entity;
    settings: NavAgentSettings;
}) {
    const session = useEditorSession();
    const { areas } = session.scene.navigation;
    return (<div role="group" aria-label="Áreas por onde o agente passa" className="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1">
      {areas.map((area, index) => index !== NOT_WALKABLE_AREA && (<label key={index} className="flex items-center gap-1.5 text-2xs text-foreground/80">
          <CheckBox checked={(settings.areaMask & areaBit(index)) !== 0} label={`Passar pela área ${area.name}`} onChange={(isAllowed) => setNavAgentArea(session, entity, index, isAllowed)}/>
          <span aria-hidden>{area.name}</span>
        </label>))}
    </div>);
}
export function NavAgentSection({ entity, settings }: {
    entity: Entity;
    settings: NavAgentSettings;
}) {
    const session = useEditorSession();
    const commitScalar = (key: NavAgentScalar, value: number) => setNavAgentScalar(session, entity, key, value);
    return (<>
      <CollapsibleSection title="NavMesh Agent" trailing={<NavRemoveButton label="Remover NavMesh Agent" onRemove={() => removeNavAgent(session, entity)}/>}>
        <TargetField entity={entity} settings={settings}/>
        <NavScalarRows rows={MOVEMENT_ROWS} owner="do agente" values={settings} onCommit={commitScalar}/>
        <ToggleField label="Frear ao chegar" hint="Desacelera perto do destino para não passar do ponto" on={settings.autoBraking} onToggle={() => setNavAgentAutoBraking(session, entity, !settings.autoBraking)}/>
        <NavScalarRows rows={SHAPE_ROWS} owner="do agente" values={settings} onCommit={commitScalar}/>
        <AgentReadout entity={entity}/>
      </CollapsibleSection>
      <CollapsibleSection title="Desvio e áreas" defaultOpen={false}>
        <PropertyRow label="Desvio" hint="Qualidade do desvio de outros agentes: mais alta enxerga mais vizinhos e custa mais">
          <SegmentedControl label="Qualidade do desvio do agente" options={AVOIDANCE_OPTIONS} value={settings.avoidance} onChange={(avoidance) => setNavAgentAvoidance(session, entity, avoidance)}/>
        </PropertyRow>
        <NavScalarRows rows={PRIORITY_ROWS} owner="de desvio do agente" values={settings} onCommit={commitScalar}/>
        <p className={NAV_HINT_CLASS}>Áreas do NavMesh por onde este agente aceita passar:</p>
        <AreaMaskField entity={entity} settings={settings}/>
      </CollapsibleSection>
    </>);
}
