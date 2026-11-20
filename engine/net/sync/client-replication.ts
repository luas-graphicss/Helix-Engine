import type { Delivery } from '../connection/delivery';
import type { NetworkObject } from '../objects/network-object';
import type { ObjectRegistry } from '../objects/object-registry';
import { MESSAGE } from '../session/session-protocol';
import type { ByteReader } from '../wire/byte-reader';
import { ByteWriter } from '../wire/byte-writer';
import { SnapshotBuffer } from './snapshot-buffer';
import { MAX_STATE_ENTRY_BYTES, readStateEntry, writeStateEntry } from './state-codec';
import { cloneTransformState, copyTransformState, transformDiffers, type TransformState } from './transform-state';
export interface OwnerUplink {
    readonly maxUnreliableBytes: number;
    send(payload: Uint8Array, delivery: Delivery): void;
}
interface OwnedRecord {
    readonly published: TransformState;
    readonly lastSent: TransformState;
    changedAt: number;
    sentAt: number;
}
const REDUNDANT_SENDS = 3;
const REFRESH_INTERVAL_MS = 1000;
export class ClientReplication {
    private readonly buffers = new Map<number, SnapshotBuffer>();
    private readonly owned = new Map<number, OwnedRecord>();
    private readonly latestTicks = new Map<number, number>();
    private readonly inputTicks = new Map<number, number>();
    private readonly writer = new ByteWriter(1500);
    private tickIntervalMs = 50;
    private sendIntervalMs = 50;
    private sequence = 0;
    private lastUploadAt = Number.NEGATIVE_INFINITY;
    configure(tickRate: number, sendRate: number): void {
        this.tickIntervalMs = 1000 / tickRate;
        this.sendIntervalMs = 1000 / sendRate;
    }
    reset(): void {
        this.buffers.clear();
        this.owned.clear();
        this.latestTicks.clear();
        this.inputTicks.clear();
        this.sequence = 0;
        this.lastUploadAt = Number.NEGATIVE_INFINITY;
    }
    forget(objectId: number): void {
        this.buffers.delete(objectId);
        this.owned.delete(objectId);
        this.latestTicks.delete(objectId);
        this.inputTicks.delete(objectId);
    }
    inputTickOf(objectId: number): number | null {
        return this.inputTicks.get(objectId) ?? null;
    }
    applyState(reader: ByteReader, objects: ObjectRegistry): void {
        const tick = reader.u32();
        while (reader.remaining > 0) {
            const entry = readStateEntry(reader);
            const object = objects.get(entry.objectId);
            if (!object)
                continue;
            if (!entry.hasScale)
                copyTransformState(entry.transform, { position: entry.transform.position, rotation: entry.transform.rotation, scale: object.transform.scale });
            if (tick > (this.latestTicks.get(object.id) ?? -1)) {
                this.latestTicks.set(object.id, tick);
                copyTransformState(object.transform, entry.transform);
                if (entry.inputTick !== null)
                    this.inputTicks.set(object.id, entry.inputTick);
            }
            this.bufferOf(object.id).push(tick * this.tickIntervalMs, entry.transform, entry.teleported);
        }
    }
    sample(objectId: number, renderTimeMs: number, target: TransformState): boolean {
        return this.buffers.get(objectId)?.sample(renderTimeMs, target) ?? false;
    }
    publish(object: NetworkObject, transform: TransformState, nowMs: number): void {
        copyTransformState(object.transform, transform);
        const record = this.owned.get(object.id);
        if (record) {
            copyTransformState(record.published, transform);
            return;
        }
        this.owned.set(object.id, { published: cloneTransformState(transform), lastSent: cloneTransformState(transform), changedAt: nowMs, sentAt: Number.NEGATIVE_INFINITY });
    }
    snapTo(object: NetworkObject, transform: TransformState, nowMs: number): void {
        this.owned.delete(object.id);
        this.buffers.delete(object.id);
        this.publish(object, transform, nowMs);
    }
    upload(nowMs: number, localId: number, objects: ObjectRegistry, uplink: OwnerUplink): void {
        if (nowMs - this.lastUploadAt < this.sendIntervalMs)
            return;
        this.lastUploadAt = nowMs;
        const writer = this.writer;
        let open = false;
        for (const [objectId, record] of this.owned) {
            const object = objects.get(objectId);
            if (!object || !object.isSimulatedBy(localId)) {
                this.owned.delete(objectId);
                continue;
            }
            if (transformDiffers(record.published, record.lastSent, object.syncScale)) {
                copyTransformState(record.lastSent, record.published);
                record.changedAt = nowMs;
            }
            if (nowMs - record.changedAt >= REDUNDANT_SENDS * this.sendIntervalMs && nowMs - record.sentAt < REFRESH_INTERVAL_MS)
                continue;
            record.sentAt = nowMs;
            if (!open) {
                this.sequence++;
                writer.reset().u8(MESSAGE.ownerState).u32(this.sequence);
                open = true;
            }
            writeStateEntry(writer, { objectId, transform: record.published, hasScale: object.syncScale, teleported: false, inputTick: null });
            if (writer.length + MAX_STATE_ENTRY_BYTES > uplink.maxUnreliableBytes) {
                uplink.send(writer.toBytes(), 'unreliable');
                open = false;
            }
        }
        if (open)
            uplink.send(writer.toBytes(), 'unreliable');
    }
    private bufferOf(objectId: number): SnapshotBuffer {
        let buffer = this.buffers.get(objectId);
        if (!buffer) {
            buffer = new SnapshotBuffer();
            this.buffers.set(objectId, buffer);
        }
        return buffer;
    }
}
