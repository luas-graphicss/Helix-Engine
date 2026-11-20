import type { Entity } from '@/engine/core/scene/entity';
import { cloneEntity, uniqueEntityName } from '@/engine/core/scene/entity-utils';
import type { Scene } from '@/engine/core/scene/scene';
export interface RemoteCopyOptions {
    readonly label: string;
    readonly simulatedHere: boolean;
    readonly keepScripts: boolean;
}
function clearNetworkObjects(entity: Entity): void {
    entity.networkObject = null;
    for (const child of entity.children)
        clearNetworkObjects(child);
}
function stripSimulation(entity: Entity, keepScripts: boolean): void {
    entity.rigidBody = null;
    entity.character = null;
    entity.vehicle = null;
    entity.wheel = null;
    entity.camera = null;
    entity.navAgent = null;
    if (!keepScripts)
        entity.script = null;
    for (const child of Array.from(entity.children)) {
        if (child.kind === 'camera' || (!keepScripts && child.kind === 'script'))
            entity.remove(child);
        else
            stripSimulation(child, keepScripts);
    }
}
export function createRemoteCopy(scene: Scene, template: Entity, options: RemoteCopyOptions): Entity {
    const copy = cloneEntity(scene, template, template.parent);
    copy.name = uniqueEntityName(scene, `${template.name} ${options.label}`, copy);
    copy.visible = true;
    clearNetworkObjects(copy);
    if (!options.simulatedHere)
        stripSimulation(copy, options.keepScripts);
    return copy;
}
