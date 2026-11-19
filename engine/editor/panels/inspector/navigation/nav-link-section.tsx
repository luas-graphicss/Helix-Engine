'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { removeNavLink, setNavLinkArea, setNavLinkCost, setNavLinkEndpoint, setNavLinkFlag } from '@/engine/editor/operations/navigation/nav-link-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { NOT_WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { AREA_COST, type NavLinkSettings } from '@/engine/navigation/link/nav-link-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ScalarField } from '../number-fields';
import { NavAreaSelect } from './nav-area-select';
import { NAV_HINT_CLASS } from './nav-field-styles';
import { NavRemoveButton } from './nav-remove-button';
import { NavVectorRow } from './nav-vector-row';
const DEFAULT_OWN_COST = 1;
export function NavLinkSection({ entity, settings }: {
    entity: Entity;
    settings: NavLinkSettings;
}) {
    const session = useEditorSession();
    const hasOwnCost = settings.costOverride !== AREA_COST;
    return (<CollapsibleSection title="Off-Mesh Link" trailing={<NavRemoveButton label="Remover Off-Mesh Link" onRemove={() => removeNavLink(session, entity)}/>}>
      <p className={NAV_HINT_CLASS}>
        Liga dois pontos que a malha não conecta, como um salto, uma escada ou uma porta. As pontas ficam no espaço do ator e precisam cair perto do NavMesh.
      </p>
      <NavVectorRow label="Início" name="Início do link" values={settings.start} onCommit={(axis, value) => setNavLinkEndpoint(session, entity, 'start', axis, value)}/>
      <NavVectorRow label="Fim" name="Fim do link" values={settings.end} onCommit={(axis, value) => setNavLinkEndpoint(session, entity, 'end', axis, value)}/>
      <ToggleField label="Ida e volta" hint="Desligado, o link só vale do início para o fim" on={settings.bidirectional} onToggle={() => setNavLinkFlag(session, entity, 'bidirectional', !settings.bidirectional)}/>
      <ToggleField label="Ativo" hint="Desligado, os agentes ignoram o link" on={settings.enabled} onToggle={() => setNavLinkFlag(session, entity, 'enabled', !settings.enabled)}/>
      <PropertyRow label="Área" hint="Define o custo da travessia e quais agentes aceitam o link">
        <NavAreaSelect label="Área do link" value={settings.area} excluded={NOT_WALKABLE_AREA} onChange={(area) => setNavLinkArea(session, entity, area)}/>
      </PropertyRow>
      <ToggleField label="Custo próprio" hint="Usa um custo fixo na travessia no lugar do custo da área" on={hasOwnCost} onToggle={() => setNavLinkCost(session, entity, hasOwnCost ? AREA_COST : DEFAULT_OWN_COST)}/>
      {hasOwnCost && (<PropertyRow label="Custo" hint="Quanto maior, mais o pathfinding evita o link">
          <ScalarField label="Custo do link" value={settings.costOverride} onCommit={(value) => setNavLinkCost(session, entity, Math.max(value, 0))}/>
        </PropertyRow>)}
    </CollapsibleSection>);
}
