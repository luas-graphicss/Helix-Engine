import type { ByteReader } from '../wire/byte-reader';
import { ByteWriter } from '../wire/byte-writer';
import { readNetValues, writeNetValues, type NetValue } from '../wire/net-value';
import { MAX_NAME_BYTES, MESSAGE } from '../session/session-protocol';
export interface NameDefinition {
    readonly id: number;
    readonly name: string;
}
export interface RpcMessage {
    readonly nameId: number;
    readonly objectId: number;
    readonly args: NetValue[];
}
export function encodeNameDefinition(definition: NameDefinition): Uint8Array {
    return new ByteWriter().u8(MESSAGE.defineName).varuint(definition.id).string(definition.name).toBytes();
}
export function decodeNameDefinition(reader: ByteReader): NameDefinition {
    return { id: reader.varuint(), name: reader.string(MAX_NAME_BYTES) };
}
export function encodeRpc(message: RpcMessage): Uint8Array {
    const writer = new ByteWriter().u8(MESSAGE.rpc).varuint(message.nameId).varuint(message.objectId);
    writeNetValues(writer, message.args);
    return writer.toBytes();
}
export function decodeRpc(reader: ByteReader): RpcMessage {
    return { nameId: reader.varuint(), objectId: reader.varuint(), args: readNetValues(reader) };
}
