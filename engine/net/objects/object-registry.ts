import { DYNAMIC_OBJECT_ID_START, NetworkObject, type NetworkObjectInit } from './network-object';
export interface RegistryObserver {
    spawned(object: NetworkObject): void;
    despawned(object: NetworkObject): void;
    ownerChanged(object: NetworkObject, previousOwnerId: number): void;
}
export class ObjectRegistry {
    private readonly objects = new Map<number, NetworkObject>();
    private nextDynamicId = DYNAMIC_OBJECT_ID_START;
    observer: RegistryObserver | null = null;
    get size(): number {
        return this.objects.size;
    }
    all(): IterableIterator<NetworkObject> {
        return this.objects.values();
    }
    get(id: number): NetworkObject | undefined {
        return this.objects.get(id);
    }
    ownedBy(ownerId: number): NetworkObject[] {
        return Array.from(this.objects.values()).filter((object) => object.ownerId === ownerId);
    }
    spawn(init: Omit<NetworkObjectInit, 'id'>): NetworkObject {
        const sceneId = init.sceneId ?? 0;
        if (sceneId >= DYNAMIC_OBJECT_ID_START)
            throw new RangeError(`scene object ${sceneId} collides with the dynamic id range`);
        return this.insert({ ...init, id: sceneId > 0 ? sceneId : this.nextDynamicId++ });
    }
    insert(init: NetworkObjectInit): NetworkObject {
        if (this.objects.has(init.id))
            throw new RangeError(`network object ${init.id} already exists`);
        const object = new NetworkObject(init);
        this.objects.set(object.id, object);
        this.observer?.spawned(object);
        return object;
    }
    despawn(id: number): boolean {
        const object = this.objects.get(id);
        if (!object)
            return false;
        this.objects.delete(id);
        this.observer?.despawned(object);
        return true;
    }
    setOwner(id: number, ownerId: number): boolean {
        const object = this.objects.get(id);
        if (!object || object.ownerId === ownerId)
            return false;
        const previousOwnerId = object.ownerId;
        object.ownerId = ownerId;
        this.observer?.ownerChanged(object, previousOwnerId);
        return true;
    }
    clear(): void {
        for (const id of Array.from(this.objects.keys()))
            this.despawn(id);
    }
}
