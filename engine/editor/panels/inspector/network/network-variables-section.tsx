'use client';
import { Plus } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addNetworkVariable, canAddNetworkVariable } from '@/engine/editor/operations/multiplayer/network-object-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { NetworkObjectSettings } from '@/engine/net/scene/network-object-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { NETWORK_HINT_CLASS } from './network-field-styles';
import { NetworkVariableRow } from './network-variable-row';
type Props = {
    entity: Entity;
    settings: NetworkObjectSettings;
};
export function NetworkVariablesSection({ entity, settings }: Props) {
    const session = useEditorSession();
    const { variables } = settings;
    return (<CollapsibleSection title="Variáveis de rede" trailing={<IconButton label="Adicionar variável de rede" size="xs" disabled={!canAddNetworkVariable(entity)} onClick={() => addNetworkVariable(session, entity)}>
          <Plus />
        </IconButton>}>
      <p className={NETWORK_HINT_CLASS}>Valores que viajam com o objeto e chegam a todos que o recebem. Nos scripts, o objeto de rede lê com get, escreve com set e observa com watch.</p>
      {variables.length > 0 && (<>
          <div className="grid grid-cols-3 gap-1 px-2 text-3xs text-muted-foreground" aria-hidden>
            <span>Tipo</span>
            <span>Valor inicial</span>
            <span>Quem escreve</span>
          </div>
          <ul className="flex flex-col">
            {variables.map((variable, index) => (<NetworkVariableRow key={variable.name} entity={entity} variable={variable} index={index}/>))}
          </ul>
        </>)}
    </CollapsibleSection>);
}
