'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { NETWORK_SPAWN_ICON } from '@/engine/editor/multiplayer/spawn-icons';
import { addNetworkObject, canAddNetworkObject } from '@/engine/editor/operations/multiplayer/network-object-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { NETWORK_SPAWN_HINT, NETWORK_SPAWN_LABEL, NETWORK_SPAWN_MODES } from '@/engine/net/scene/network-object-settings';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { NETWORK_HINT_CLASS } from './network-field-styles';
export function NetworkAddSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    if (!canAddNetworkObject(entity))
        return null;
    return (<CollapsibleSection title="Multiplayer" defaultOpen={false}>
      <p className={NETWORK_HINT_CLASS}>Põe este ator na sessão de rede. Passe o mouse em cada opção para ver como ele entra.</p>
      <ActionRow>
        {NETWORK_SPAWN_MODES.map((mode) => (<ActionButton key={mode} icon={NETWORK_SPAWN_ICON[mode]} title={NETWORK_SPAWN_HINT[mode]} onClick={() => addNetworkObject(session, entity, mode)}>
            {NETWORK_SPAWN_LABEL[mode]}
          </ActionButton>))}
      </ActionRow>
    </CollapsibleSection>);
}
