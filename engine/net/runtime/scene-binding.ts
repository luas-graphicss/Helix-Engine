import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { SERVER_OWNER_ID, type NetworkObject } from '../objects/network-object';
import type { ObjectRegistry } from '../objects/object-registry';
import { readEntityTransform, writeEntityTransform } from '../scene/entity-transform';
import { networkEntities, templateEntity } from '../scene/scene-network-plan';
import type { NetClient } from '../session/net-client';
import type { NetServer } from '../session/net-server';
import { createTransformState } from '../sync/transform-state';
import { createRemoteCopy } from './remote-copy';
import type { BindingListener, BoundObject } from './runtime-events';
export interface BindingHost {
    readonly scene: Scene;
    entitySpawned(entity: Entity): void;
    entityRemoved(entity: Entity): void;
}
interface ResolvedEntity {
    readonly entity: Entity;
    readonly isCopy: boolean;
}
export class SceneBinding {
    private readonly byObject = new Map<number, BoundObject>();
    private readonly byEntity = new Map<Entity, BoundObject>();
    private readonly hidden = new Set<Entity>();
    private readonly scratch = createTransformState();
    constructor(private readonly host: BindingHost, private readonly listener: BindingListener) { }
    get size(): number {
        return this.byObject.size;
    }
    all(): BoundObject[] {
        return Array.from(this.byObject.values());
    }
    ofObject(objectId: number): BoundObject | undefined {
        return this.byObject.get(objectId);
    }
    ofEntity(entity: Entity): BoundObject | undefined {
        return this.byEntity.get(entity);
    }
    hideTemplates(): void {
        for (const entity of networkEntities(this.host.scene))
            if (entity.networkObject?.spawn === 'template')
                this.hide(entity);
    }
    reconcile(objects: ObjectRegistry, localId: number, hostsSession: boolean): void {
        for (const binding of this.all()) {
            const current = objects.get(binding.objectId);
            if (current && current.kind === binding.object.kind)
                binding.object = current;
            else
                this.unbind(binding, true);
        }
        for (const object of objects.all())
            if (!this.byObject.has(object.id))
                this.bind(object, localId, hostsSession);
    }
    sync(client: NetClient, authority: NetServer | null): void {
        const localId = client.localId;
        for (const { object, entity } of this.byObject.values()) {
            const hosted = authority?.objects.get(object.id);
            if (hosted?.isSimulatedBy(SERVER_OWNER_ID))
                readEntityTransform(entity, hosted.transform);
            else if (object.isSimulatedBy(localId))
                client.publishTransform(object.id, readEntityTransform(entity, this.scratch));
            else if (client.sampleTransform(object.id, this.scratch))
                writeEntityTransform(entity, this.scratch, object.syncScale);
        }
    }
    snap(object: NetworkObject): BoundObject | undefined {
        const binding = this.byObject.get(object.id);
        if (binding)
            writeEntityTransform(binding.entity, object.transform, object.syncScale);
        return binding;
    }
    release(): void {
        for (const binding of this.all())
            this.unbind(binding, false);
    }
    clear(): void {
        this.release();
        for (const entity of this.hidden)
            entity.visible = true;
        this.hidden.clear();
    }
    private hide(entity: Entity): void {
        if (!entity.visible)
            return;
        entity.visible = false;
        this.hidden.add(entity);
    }
    private show(entity: Entity): void {
        if (this.hidden.delete(entity))
            entity.visible = true;
    }
    private bind(object: NetworkObject, localId: number, hostsSession: boolean): void {
        const resolved = this.resolve(object, localId, hostsSession);
        if (!resolved)
            return;
        const binding: BoundObject = { objectId: object.id, entity: resolved.entity, isCopy: resolved.isCopy, object };
        this.byObject.set(object.id, binding);
        this.byEntity.set(resolved.entity, binding);
        this.show(resolved.entity);
        this.listener.objectBound(binding);
    }
    private unbind(binding: BoundObject, despawned: boolean): void {
        this.byObject.delete(binding.objectId);
        this.byEntity.delete(binding.entity);
        this.listener.objectUnbound(binding);
        if (binding.isCopy)
            this.host.entityRemoved(binding.entity);
        else if (despawned && binding.object.sceneId > 0)
            this.hide(binding.entity);
    }
    private resolve(object: NetworkObject, localId: number, hostsSession: boolean): ResolvedEntity | null {
        const { scene } = this.host;
        if (object.sceneId > 0) {
            const entity = scene.findById(object.sceneId);
            return entity?.networkObject && !this.byEntity.has(entity) ? { entity, isCopy: false } : null;
        }
        const template = templateEntity(scene, object.kind);
        const settings = template?.networkObject;
        if (!template || !settings)
            return null;
        if (settings.spawn === 'player' && object.ownerId === localId && !this.byEntity.has(template))
            return { entity: template, isCopy: false };
        const simulatedHere = object.isSimulatedBy(localId) || (hostsSession && object.isSimulatedBy(SERVER_OWNER_ID));
        const copy = createRemoteCopy(scene, template, { label: `#${object.id}`, simulatedHere, keepScripts: settings.remoteScripts });
        writeEntityTransform(copy, object.transform, object.syncScale);
        this.host.entitySpawned(copy);
        return { entity: copy, isCopy: true };
    }
}
