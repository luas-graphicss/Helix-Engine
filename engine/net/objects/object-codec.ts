import type { ByteReader } from '../wire/byte-reader';
import { ByteWriter } from '../wire/byte-writer';
import { readNetValue, writeNetValue, type NetValue } from '../wire/net-value';
import { WireError } from '../wire/wire-error';
import { MAX_NAME_BYTES, MESSAGE } from '../session/session-protocol';
import { readTransform, writeTransform } from '../sync/state-codec';
import type { TransformState } from '../sync/transform-state';
import type { NetworkObject, NetworkObjectInit } from './network-object';
import type { VariableDefinition } from './variable-set';
const MAX_VARIABLES = 256;
const MAX_INPUTS_PER_MESSAGE = 16;
const FLAG_OWNER_AUTHORITY = 1;
const FLAG_SYNC_SCALE = 2;
const FLAG_OWNER_WRITER = 1;
export interface VariableChange {
    readonly index: number;
    readonly value: NetValue;
}
export interface VariableUpdate {
    readonly objectId: number;
    readonly changes: VariableChange[];
}
export interface OwnerChange {
    readonly objectId: number;
    readonly ownerId: number;
}
export interface Correction {
    readonly objectId: number;
    readonly transform: TransformState;
}
export interface InputEntry {
    readonly tick: number;
    readonly input: NetValue;
}
export interface InputBatch {
    readonly objectId: number;
    readonly entries: InputEntry[];
}
export function encodeSpawn(object: NetworkObject): Uint8Array {
    const variables = object.variables.snapshot();
    const flags = (object.authority === 'owner' ? FLAG_OWNER_AUTHORITY : 0) | (object.syncScale ? FLAG_SYNC_SCALE : 0);
    const writer = new ByteWriter().u8(MESSAGE.spawn).varuint(object.id).string(object.kind).varuint(object.sceneId).varuint(object.ownerId).u8(flags);
    writeTransform(writer, object.transform, true);
    writer.varuint(variables.length);
    for (const variable of variables) {
        writer.string(variable.name).u8(variable.writer === 'owner' ? FLAG_OWNER_WRITER : 0);
        writeNetValue(writer, variable.initial);
    }
    return writer.toBytes();
}
export function decodeSpawn(reader: ByteReader): NetworkObjectInit {
    const id = reader.varuint();
    const kind = reader.string(MAX_NAME_BYTES);
    const sceneId = reader.varuint();
    const ownerId = reader.varuint();
    const flags = reader.u8();
    const transform = readTransform(reader, true);
    const count = reader.varuint();
    if (count > MAX_VARIABLES)
        throw new WireError(`object ${id} declares ${count} variables`);
    const variables: VariableDefinition[] = [];
    for (let index = 0; index < count; index++) {
        const name = reader.string(MAX_NAME_BYTES);
        const writer = (reader.u8() & FLAG_OWNER_WRITER) !== 0 ? 'owner' : 'server';
        variables.push({ name, writer, initial: readNetValue(reader) });
    }
    return { id, kind, sceneId, ownerId, transform, variables, authority: (flags & FLAG_OWNER_AUTHORITY) !== 0 ? 'owner' : 'server', syncScale: (flags & FLAG_SYNC_SCALE) !== 0 };
}
export function encodeDespawn(objectId: number): Uint8Array {
    return new ByteWriter().u8(MESSAGE.despawn).varuint(objectId).toBytes();
}
export function encodeOwnerChange(change: OwnerChange): Uint8Array {
    return new ByteWriter().u8(MESSAGE.ownerChanged).varuint(change.objectId).varuint(change.ownerId).toBytes();
}
export function decodeOwnerChange(reader: ByteReader): OwnerChange {
    return { objectId: reader.varuint(), ownerId: reader.varuint() };
}
export function encodeVariableUpdate(update: VariableUpdate): Uint8Array {
    const writer = new ByteWriter().u8(MESSAGE.variables).varuint(update.objectId).varuint(update.changes.length);
    for (const change of update.changes) {
        writer.varuint(change.index);
        writeNetValue(writer, change.value);
    }
    return writer.toBytes();
}
export function decodeVariableUpdate(reader: ByteReader): VariableUpdate {
    const objectId = reader.varuint();
    const count = reader.varuint();
    if (count > MAX_VARIABLES)
        throw new WireError(`update carries ${count} variables`);
    const changes: VariableChange[] = [];
    for (let index = 0; index < count; index++)
        changes.push({ index: reader.varuint(), value: readNetValue(reader) });
    return { objectId, changes };
}
export function encodeVariableSet(objectId: number, change: VariableChange): Uint8Array {
    const writer = new ByteWriter().u8(MESSAGE.variableSet).varuint(objectId).varuint(change.index);
    writeNetValue(writer, change.value);
    return writer.toBytes();
}
export function decodeVariableSet(reader: ByteReader): {
    readonly objectId: number;
    readonly change: VariableChange;
} {
    const objectId = reader.varuint();
    return { objectId, change: { index: reader.varuint(), value: readNetValue(reader) } };
}
export function encodeCorrection(correction: Correction): Uint8Array {
    const writer = new ByteWriter().u8(MESSAGE.correction).varuint(correction.objectId);
    writeTransform(writer, correction.transform, true);
    return writer.toBytes();
}
export function decodeCorrection(reader: ByteReader): Correction {
    return { objectId: reader.varuint(), transform: readTransform(reader, true) };
}
export function encodeInputBatch(batch: InputBatch): Uint8Array {
    const entries = batch.entries.slice(-MAX_INPUTS_PER_MESSAGE);
    const writer = new ByteWriter().u8(MESSAGE.input).varuint(batch.objectId).u8(entries.length);
    for (const entry of entries) {
        writer.u32(entry.tick);
        writeNetValue(writer, entry.input);
    }
    return writer.toBytes();
}
export function decodeInputBatch(reader: ByteReader): InputBatch {
    const objectId = reader.varuint();
    const count = reader.u8();
    if (count > MAX_INPUTS_PER_MESSAGE)
        throw new WireError(`input batch carries ${count} entries`);
    const entries: InputEntry[] = [];
    for (let index = 0; index < count; index++)
        entries.push({ tick: reader.u32(), input: readNetValue(reader) });
    return { objectId, entries };
}
export function encodeOwnershipRequest(objectId: number): Uint8Array {
    return new ByteWriter().u8(MESSAGE.ownershipRequest).varuint(objectId).toBytes();
}
