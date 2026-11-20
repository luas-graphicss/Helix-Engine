import type { Entity } from '@/engine/core/scene/entity';
import { SERVER_OWNER_ID } from '../objects/network-object';
import { writeEntityTransform } from '../scene/entity-transform';
import { networkKind, type SceneNetworkPlan } from '../scene/scene-network-plan';
import type { NetClient } from '../session/net-client';
import type { NetServer } from '../session/net-server';
import type { TransformState } from '../sync/transform-state';
import type { NetValue } from '../wire/net-value';
import type { SceneBinding } from './scene-binding';
export interface SpawnOptions {
    readonly ownerId?: number;
    readonly transform?: TransformState;
}
export interface ObjectCommandContext {
    readonly plan: SceneNetworkPlan;
    readonly binding: SceneBinding;
    authority(): NetServer | null;
    client(): NetClient | null;
}
export class ObjectCommands {
    constructor(private readonly context: ObjectCommandContext) { }
    spawn(template: Entity, options: SpawnOptions = {}): number | null {
        const { plan } = this.context;
        const server = this.context.authority();
        const kind = networkKind(template);
        const seed = plan.spawnTemplates.find((candidate) => candidate.kind === kind) ?? plan.playerTemplates.find((candidate) => candidate.kind === kind);
        if (!server || !seed)
            return null;
        return server.objects.spawn({ ...seed, ownerId: options.ownerId ?? SERVER_OWNER_ID, transform: options.transform ?? seed.transform }).id;
    }
    despawn(objectId: number): boolean {
        return this.context.authority()?.objects.despawn(objectId) ?? false;
    }
    setOwner(objectId: number, ownerId: number): boolean {
        const server = this.context.authority();
        const object = server?.objects.get(objectId);
        if (!server || !object || (ownerId !== SERVER_OWNER_ID && !server.players.some((player) => player.id === ownerId)))
            return false;
        server.objects.setOwner(objectId, ownerId);
        return true;
    }
    requestOwnership(objectId: number): boolean {
        return this.context.client()?.requestOwnership(objectId) ?? false;
    }
    teleport(objectId: number, transform: TransformState): boolean {
        if (!this.context.authority()?.teleport(objectId, transform))
            return false;
        const bound = this.context.binding.ofObject(objectId);
        if (bound)
            writeEntityTransform(bound.entity, transform, bound.object.syncScale);
        return true;
    }
    setVariable(objectId: number, name: string, value: NetValue): boolean {
        const hosted = this.context.authority()?.objects.get(objectId);
        if (hosted)
            return hosted.variables.set(name, value);
        return this.context.client()?.setVariable(objectId, name, value) ?? false;
    }
    kick(playerId: number, reason: string): boolean {
        return this.context.authority()?.kick(playerId, reason) ?? false;
    }
}
