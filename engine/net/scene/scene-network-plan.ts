import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { DYNAMIC_OBJECT_ID_START, type NetworkObjectInit } from '../objects/network-object';
import type { SceneObjectSeed } from '../server/server-config';
import { SESSION_PROTOCOL_VERSION } from '../session/session-protocol';
import { createTransformState } from '../sync/transform-state';
import { readEntityTransform } from './entity-transform';
import { relevanceOf, variableDefinitionsOf, type NetworkObjectSettings } from './network-object-settings';
export type NetworkTemplate = Omit<NetworkObjectInit, 'id' | 'ownerId' | 'sceneId'> & {
    readonly kind: string;
};
export interface SceneNetworkPlan {
    readonly sceneObjects: readonly SceneObjectSeed[];
    readonly playerTemplates: readonly NetworkTemplate[];
    readonly spawnTemplates: readonly NetworkTemplate[];
    readonly transferableKinds: readonly string[];
    readonly outOfRange: readonly string[];
    readonly schema: string;
}
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SECOND_HASH_SEED = 0x9e3779b9;
export function networkKind(entity: Entity): string {
    return String(entity.id);
}
export function templateEntity(scene: Scene, kind: string): Entity | null {
    const id = Number(kind);
    const entity = Number.isInteger(id) ? scene.findById(id) : null;
    return entity?.networkObject ? entity : null;
}
export function networkEntities(scene: Scene): Entity[] {
    return scene.entities.filter((entity) => entity.networkObject !== null);
}
function describeTemplate(entity: Entity, settings: NetworkObjectSettings): NetworkTemplate {
    return {
        kind: networkKind(entity),
        authority: settings.authority,
        transform: readEntityTransform(entity, createTransformState()),
        variables: variableDefinitionsOf(settings),
        syncScale: settings.syncScale,
        relevance: relevanceOf(settings),
        observer: settings.observer,
        ownerLeftPolicy: settings.ownerLeftPolicy,
        maxSpeed: settings.maxSpeed,
    };
}
function hashText(text: string, seed: number): string {
    let hash = seed;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, FNV_PRIME);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
function schemaEntry(mode: string, template: NetworkTemplate): unknown[] {
    const variables = (template.variables ?? []).map(({ name, writer, initial }) => [name, writer, typeof initial]);
    return [mode, template.kind, template.authority, template.syncScale, template.ownerLeftPolicy, variables];
}
export function planSceneNetwork(scene: Scene): SceneNetworkPlan {
    const sceneObjects: SceneObjectSeed[] = [];
    const playerTemplates: NetworkTemplate[] = [];
    const spawnTemplates: NetworkTemplate[] = [];
    const transferableKinds: string[] = [];
    const outOfRange: string[] = [];
    const schemaEntries: unknown[][] = [];
    for (const entity of networkEntities(scene)) {
        const settings = entity.networkObject;
        if (!settings)
            continue;
        if (entity.id >= DYNAMIC_OBJECT_ID_START) {
            outOfRange.push(entity.name);
            continue;
        }
        const template = describeTemplate(entity, settings);
        if (settings.transferable)
            transferableKinds.push(template.kind);
        schemaEntries.push(schemaEntry(settings.spawn, template));
        if (settings.spawn === 'scene')
            sceneObjects.push({ ...template, sceneId: entity.id });
        else if (settings.spawn === 'player')
            playerTemplates.push(template);
        else
            spawnTemplates.push(template);
    }
    const canonical = JSON.stringify([SESSION_PROTOCOL_VERSION, schemaEntries]);
    return { sceneObjects, playerTemplates, spawnTemplates, transferableKinds, outOfRange, schema: `${hashText(canonical, FNV_OFFSET)}${hashText(canonical, SECOND_HASH_SEED)}` };
}
