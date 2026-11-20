import type { Delivery } from '../connection/delivery';
import { SERVER_OWNER_ID, type NetworkObject } from '../objects/network-object';
import { encodeCorrection, encodeDespawn, encodeOwnerChange, encodeSpawn, encodeVariableUpdate } from '../objects/object-codec';
import type { ObjectRegistry } from '../objects/object-registry';
import { isRelevantTo } from '../objects/relevance';
import { MESSAGE } from '../session/session-protocol';
import type { ByteReader } from '../wire/byte-reader';
import { ByteWriter } from '../wire/byte-writer';
import { MovementBudget } from './movement-budget';
import { MAX_STATE_ENTRY_BYTES, readStateEntry, writeStateEntry, type StateEntry } from './state-codec';
import { TransformHistory } from './transform-history';
import { cloneTransformState, copyTransformState, transformDiffers, type TransformState, type Vector3Tuple } from './transform-state';
export interface ReplicationTarget {
    readonly playerId: number;
    readonly visible: Set<number>;
    readonly maxUnreliableBytes: number;
    send(payload: Uint8Array, delivery: Delivery): void;
}
interface SyncRecord {
    readonly lastSent: TransformState;
    changedTick: number;
    teleportTick: number;
    inputTick: number | null;
    ownerSequence: number;
    correctedAt: number;
    budget: MovementBudget;
}
const REDUNDANT_SENDS = 3;
const REFRESH_SENDS = 30;
const INTEREST_INTERVAL_TICKS = 6;
const CORRECTION_INTERVAL_MS = 250;
export class ServerReplication {
    readonly history = new TransformHistory();
    private readonly records = new Map<number, SyncRecord>();
    private readonly stateWriter = new ByteWriter(1500);
    private tick = 0;
    private timeMs = 0;
    constructor(private readonly objects: ObjectRegistry, private readonly targets: () => Iterable<ReplicationTarget>, private readonly sendEveryTicks: number) { }
    objectSpawned(object: NetworkObject): void {
        this.records.set(object.id, {
            lastSent: cloneTransformState(object.transform),
            changedTick: this.tick,
            teleportTick: Number.NEGATIVE_INFINITY,
            inputTick: null,
            ownerSequence: 0,
            correctedAt: Number.NEGATIVE_INFINITY,
            budget: new MovementBudget(object.maxSpeed),
        });
        this.history.record(object.id, this.timeMs, object.transform);
        for (const target of this.targets())
            if (isRelevantTo(object, target.playerId, this.observersOf(target), false))
                this.reveal(target, object);
    }
    objectDespawned(object: NetworkObject): void {
        this.records.delete(object.id);
        this.history.forget(object.id);
        for (const target of this.targets())
            this.conceal(target, object.id);
    }
    ownerChanged(object: NetworkObject): void {
        const record = this.records.get(object.id);
        if (record) {
            record.ownerSequence = 0;
            record.budget = new MovementBudget(object.maxSpeed);
        }
        const payload = encodeOwnerChange({ objectId: object.id, ownerId: object.ownerId });
        for (const target of this.targets()) {
            if (target.visible.has(object.id))
                target.send(payload, 'reliable');
            else if (target.playerId === object.ownerId)
                this.reveal(target, object);
        }
    }
    syncTarget(target: ReplicationTarget): void {
        target.visible.clear();
        for (const object of this.objects.ownedBy(target.playerId)) {
            const record = this.records.get(object.id);
            if (record)
                record.ownerSequence = 0;
        }
        this.refreshInterest(target);
    }
    teleport(object: NetworkObject, transform: TransformState): void {
        copyTransformState(object.transform, transform);
        const record = this.records.get(object.id);
        if (record) {
            record.teleportTick = this.tick;
            record.changedTick = this.tick;
        }
        if (object.authority !== 'owner' || object.ownerId === SERVER_OWNER_ID)
            return;
        for (const target of this.targets())
            if (target.playerId === object.ownerId)
                target.send(encodeCorrection({ objectId: object.id, transform: object.transform }), 'reliable');
    }
    acknowledgeInput(objectId: number, inputTick: number): void {
        const record = this.records.get(objectId);
        if (!record)
            return;
        record.inputTick = inputTick;
        record.changedTick = this.tick;
    }
    afterTick(tick: number, timeMs: number): void {
        this.tick = tick;
        this.timeMs = timeMs;
        for (const object of this.objects.all())
            this.flushVariables(object);
        if (tick % INTEREST_INTERVAL_TICKS === 0)
            for (const target of this.targets())
                this.refreshInterest(target);
        if (tick % this.sendEveryTicks !== 0)
            return;
        for (const object of this.objects.all())
            this.detectChange(object);
        for (const target of this.targets())
            this.sendState(target);
    }
    acceptOwnerState(target: ReplicationTarget, reader: ByteReader, nowMs: number): void {
        const sequence = reader.u32();
        while (reader.remaining > 0)
            this.applyOwnerEntry(target, sequence, readStateEntry(reader), nowMs);
    }
    private applyOwnerEntry(target: ReplicationTarget, sequence: number, entry: StateEntry, nowMs: number): void {
        const object = this.objects.get(entry.objectId);
        const record = this.records.get(entry.objectId);
        if (!object || !record || object.authority !== 'owner' || object.ownerId !== target.playerId || sequence <= record.ownerSequence)
            return;
        record.ownerSequence = sequence;
        if (!record.budget.allows(object.transform.position, entry.transform.position, nowMs)) {
            if (nowMs - record.correctedAt < CORRECTION_INTERVAL_MS)
                return;
            record.correctedAt = nowMs;
            target.send(encodeCorrection({ objectId: object.id, transform: object.transform }), 'reliable');
            return;
        }
        const scale: Vector3Tuple = entry.hasScale && object.syncScale ? entry.transform.scale : object.transform.scale;
        copyTransformState(object.transform, { position: entry.transform.position, rotation: entry.transform.rotation, scale });
    }
    private observersOf(target: ReplicationTarget): Vector3Tuple[] {
        const observers: Vector3Tuple[] = [];
        for (const object of this.objects.all())
            if (object.observer && object.ownerId === target.playerId)
                observers.push(object.transform.position);
        return observers;
    }
    private refreshInterest(target: ReplicationTarget): void {
        const observers = this.observersOf(target);
        for (const object of this.objects.all()) {
            const visible = target.visible.has(object.id);
            const relevant = isRelevantTo(object, target.playerId, observers, visible);
            if (relevant && !visible)
                this.reveal(target, object);
            else if (!relevant && visible)
                this.conceal(target, object.id);
        }
    }
    private reveal(target: ReplicationTarget, object: NetworkObject): void {
        target.visible.add(object.id);
        target.send(encodeSpawn(object), 'reliable');
    }
    private conceal(target: ReplicationTarget, objectId: number): void {
        if (target.visible.delete(objectId))
            target.send(encodeDespawn(objectId), 'reliable');
    }
    private flushVariables(object: NetworkObject): void {
        if (!object.variables.hasDirty)
            return;
        const changes = object.variables.takeDirty().map((index) => ({ index, value: object.variables.valueAt(index) }));
        const payload = encodeVariableUpdate({ objectId: object.id, changes });
        for (const target of this.targets())
            if (target.visible.has(object.id))
                target.send(payload, 'reliable');
    }
    private detectChange(object: NetworkObject): void {
        const record = this.records.get(object.id);
        if (!record || !transformDiffers(object.transform, record.lastSent, object.syncScale))
            return;
        copyTransformState(record.lastSent, object.transform);
        record.changedTick = this.tick;
        this.history.record(object.id, this.timeMs, object.transform);
    }
    private sendState(target: ReplicationTarget): void {
        const writer = this.stateWriter;
        const redundancyTicks = REDUNDANT_SENDS * this.sendEveryTicks;
        const sendIndex = this.tick / this.sendEveryTicks;
        let open = false;
        for (const id of target.visible) {
            const object = this.objects.get(id);
            const record = this.records.get(id);
            if (!object || !record || (object.authority === 'owner' && object.ownerId === target.playerId))
                continue;
            if (this.tick - record.changedTick >= redundancyTicks && (sendIndex + id) % REFRESH_SENDS !== 0)
                continue;
            if (!open) {
                writer.reset().u8(MESSAGE.state).u32(this.tick);
                open = true;
            }
            writeStateEntry(writer, {
                objectId: id,
                transform: object.transform,
                hasScale: object.syncScale,
                teleported: this.tick - record.teleportTick < redundancyTicks,
                inputTick: object.ownerId === target.playerId ? record.inputTick : null,
            });
            if (writer.length + MAX_STATE_ENTRY_BYTES > target.maxUnreliableBytes) {
                target.send(writer.toBytes(), 'unreliable');
                open = false;
            }
        }
        if (open)
            target.send(writer.toBytes(), 'unreliable');
    }
}
