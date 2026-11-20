'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { updateNetworkObject } from '@/engine/editor/operations/multiplayer/network-object-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { OWNER_LEFT_LABEL, OWNER_LEFT_POLICIES, RELEVANCE_LABEL, RELEVANCE_MODES, type NetworkObjectSettings } from '@/engine/net/scene/network-object-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ScalarField } from '../number-fields';
type Props = {
    entity: Entity;
    settings: NetworkObjectSettings;
};
const RELEVANCE_OPTIONS = RELEVANCE_MODES.map((mode) => ({ value: mode, label: RELEVANCE_LABEL[mode] }));
const OWNER_LEFT_OPTIONS = OWNER_LEFT_POLICIES.map((policy) => ({ value: policy, label: OWNER_LEFT_LABEL[policy] }));
export function NetworkOwnershipSection({ entity, settings }: Props) {
    const session = useEditorSession();
    const update = (patch: Partial<NetworkObjectSettings>) => updateNetworkObject(session, entity, patch);
    return (<CollapsibleSection title="Posse e relevância" defaultOpen={false}>
      <PropertyRow label="Quem recebe" hint="Para quais jogadores o servidor envia este objeto">
        <SelectField label="Quem recebe o objeto" options={RELEVANCE_OPTIONS} value={settings.relevance} onChange={(relevance) => update({ relevance })}/>
      </PropertyRow>
      {settings.relevance === 'distance' && (<PropertyRow label="Raio" hint="Distância até onde o objeto é enviado, medida a partir dos objetos marcados como Observador de cada jogador">
          <ScalarField label="Raio de relevância" value={settings.relevanceRadius} suffix=" m" onCommit={(relevanceRadius) => {
                if (Number.isFinite(relevanceRadius))
                    update({ relevanceRadius });
            }}/>
        </PropertyRow>)}
      <ToggleField label="Observador" hint="A posição deste objeto é o ponto de vista do dono: a relevância por distância dos outros objetos é medida a partir dele." on={settings.observer} onToggle={() => update({ observer: !settings.observer })}/>
      <ToggleField label="Transferível" hint="Jogadores podem pedir a posse deste objeto. Desligado, só o servidor troca o dono." on={settings.transferable} onToggle={() => update({ transferable: !settings.transferable })}/>
      <PropertyRow label="Dono saiu" hint="O que o servidor faz com o objeto quando o jogador dono sai da sessão">
        <SelectField label="O que fazer quando o dono sai" options={OWNER_LEFT_OPTIONS} value={settings.ownerLeftPolicy} onChange={(ownerLeftPolicy) => update({ ownerLeftPolicy })}/>
      </PropertyRow>
    </CollapsibleSection>);
}
