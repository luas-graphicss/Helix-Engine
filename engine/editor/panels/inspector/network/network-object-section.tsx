'use client';
import { Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { removeNetworkObject, updateNetworkObject } from '@/engine/editor/operations/multiplayer/network-object-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { AUTHORITY_HINT, AUTHORITY_LABEL, AUTHORITY_MODES, NETWORK_SPAWN_HINT, NETWORK_SPAWN_LABEL, NETWORK_SPAWN_MODES, type NetworkObjectSettings } from '@/engine/net/scene/network-object-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ScalarField } from '../number-fields';
import { NETWORK_HINT_CLASS } from './network-field-styles';
type Props = {
    entity: Entity;
    settings: NetworkObjectSettings;
};
const SPAWN_OPTIONS = NETWORK_SPAWN_MODES.map((mode) => ({ value: mode, label: NETWORK_SPAWN_LABEL[mode] }));
const AUTHORITY_OPTIONS = AUTHORITY_MODES.map((mode) => ({ value: mode, label: AUTHORITY_LABEL[mode] }));
export function NetworkObjectSection({ entity, settings }: Props) {
    const session = useEditorSession();
    const update = (patch: Partial<NetworkObjectSettings>) => updateNetworkObject(session, entity, patch);
    return (<CollapsibleSection title="Objeto de rede" trailing={<IconButton label="Tirar o ator da rede" size="xs" className="hover:text-destructive" onClick={() => removeNetworkObject(session, entity)}>
          <Trash2 />
        </IconButton>}>
      <PropertyRow label="Entrada" hint="Como o objeto entra na sessão">
        <SelectField label="Como o objeto entra na sessão" options={SPAWN_OPTIONS} value={settings.spawn} onChange={(spawn) => update({ spawn })}/>
      </PropertyRow>
      <p className={NETWORK_HINT_CLASS}>{NETWORK_SPAWN_HINT[settings.spawn]}</p>
      <PropertyRow label="Autoridade" hint="Quem move o objeto">
        <SegmentedControl label="Quem move o objeto" options={AUTHORITY_OPTIONS} value={settings.authority} onChange={(authority) => update({ authority })}/>
      </PropertyRow>
      <p className={NETWORK_HINT_CLASS}>{AUTHORITY_HINT[settings.authority]}</p>
      {settings.authority === 'owner' && (<PropertyRow label="Vel. máxima" hint="Maior velocidade que o servidor aceita do dono. Acima disso ele devolve o objeto ao último lugar válido. 0 não confere.">
          <ScalarField label="Velocidade máxima aceita do dono" value={settings.maxSpeed} suffix=" m/s" onCommit={(maxSpeed) => {
                if (Number.isFinite(maxSpeed))
                    update({ maxSpeed });
            }}/>
        </PropertyRow>)}
      <ToggleField label="Escala" hint="Envia também a escala. Desligado, só posição e rotação viajam." on={settings.syncScale} onToggle={() => update({ syncScale: !settings.syncScale })}/>
      <ToggleField label="Scripts" hint="As cópias deste objeto nas máquinas que não o simulam ficam sem física, câmera e scripts. Ligue para manter os scripts nelas." on={settings.remoteScripts} onToggle={() => update({ remoteScripts: !settings.remoteScripts })}/>
    </CollapsibleSection>);
}
