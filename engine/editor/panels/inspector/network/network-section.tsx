'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { NetworkAddSection } from './network-add-section';
import { NetworkObjectSection } from './network-object-section';
import { NetworkOwnershipSection } from './network-ownership-section';
import { NetworkVariablesSection } from './network-variables-section';
export function NetworkSection({ entity }: {
    entity: Entity;
}) {
    const settings = entity.networkObject;
    if (!settings)
        return <NetworkAddSection entity={entity}/>;
    return (<>
      <NetworkObjectSection entity={entity} settings={settings}/>
      <NetworkOwnershipSection entity={entity} settings={settings}/>
      <NetworkVariablesSection entity={entity} settings={settings}/>
    </>);
}
