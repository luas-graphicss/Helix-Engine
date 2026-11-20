import type { ByteReader } from '../wire/byte-reader';
import type { ByteWriter } from '../wire/byte-writer';
import { packQuaternion, unpackQuaternion } from '../wire/quantize';
import { WireError } from '../wire/wire-error';
import { createTransformState, type TransformState } from './transform-state';
export const MAX_STATE_ENTRY_BYTES = 40;
const FLAG_SCALE = 1;
const FLAG_TELEPORT = 2;
const FLAG_INPUT_TICK = 4;
export interface StateEntry {
    readonly objectId: number;
    readonly transform: TransformState;
    readonly hasScale: boolean;
    readonly teleported: boolean;
    readonly inputTick: number | null;
}
function readCoordinate(reader: ByteReader): number {
    const coordinate = reader.f32();
    if (!Number.isFinite(coordinate))
        throw new WireError('non-finite coordinate in a transform');
    return coordinate;
}
export function writeTransform(writer: ByteWriter, transform: TransformState, includeScale: boolean): void {
    writer.f32(transform.position[0]).f32(transform.position[1]).f32(transform.position[2]).u32(packQuaternion(transform.rotation));
    if (includeScale)
        writer.f32(transform.scale[0]).f32(transform.scale[1]).f32(transform.scale[2]);
}
export function readTransform(reader: ByteReader, includesScale: boolean): TransformState {
    const transform = createTransformState();
    for (let axis = 0; axis < 3; axis++)
        transform.position[axis] = readCoordinate(reader);
    unpackQuaternion(reader.u32(), transform.rotation);
    if (includesScale)
        for (let axis = 0; axis < 3; axis++)
            transform.scale[axis] = readCoordinate(reader);
    return transform;
}
export function writeStateEntry(writer: ByteWriter, entry: StateEntry): void {
    const flags = (entry.hasScale ? FLAG_SCALE : 0) | (entry.teleported ? FLAG_TELEPORT : 0) | (entry.inputTick === null ? 0 : FLAG_INPUT_TICK);
    writer.varuint(entry.objectId).u8(flags);
    writeTransform(writer, entry.transform, entry.hasScale);
    if (entry.inputTick !== null)
        writer.u32(entry.inputTick);
}
export function readStateEntry(reader: ByteReader): StateEntry {
    const objectId = reader.varuint();
    const flags = reader.u8();
    const hasScale = (flags & FLAG_SCALE) !== 0;
    const transform = readTransform(reader, hasScale);
    const inputTick = (flags & FLAG_INPUT_TICK) !== 0 ? reader.u32() : null;
    return { objectId, transform, hasScale, teleported: (flags & FLAG_TELEPORT) !== 0, inputTick };
}
