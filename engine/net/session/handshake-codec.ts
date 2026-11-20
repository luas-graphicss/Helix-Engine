import type { ByteReader } from '../wire/byte-reader';
import { ByteWriter } from '../wire/byte-writer';
import { readNetValue, writeNetValue, type NetValue } from '../wire/net-value';
import { WireError } from '../wire/wire-error';
import { MAX_NAME_BYTES, MAX_REASON_BYTES, MAX_TOKEN_BYTES, MESSAGE, type SessionPlayer } from './session-protocol';
const MAX_ROSTER_SIZE = 1024;
export interface HelloMessage {
    readonly protocol: number;
    readonly schema: string;
    readonly name: string;
    readonly ticket: NetValue;
    readonly resumeToken: string;
}
export interface WelcomeMessage {
    readonly clientId: number;
    readonly tickRate: number;
    readonly sendRate: number;
    readonly tick: number;
    readonly resumed: boolean;
    readonly resumeToken: string;
    readonly sessionId: string;
    readonly players: SessionPlayer[];
}
export interface PongMessage {
    readonly clientSentAt: number;
    readonly serverReceivedAt: number;
    readonly serverSentAt: number;
}
function writePlayer(writer: ByteWriter, player: SessionPlayer): void {
    writer.varuint(player.id).string(player.name);
}
function readPlayer(reader: ByteReader): SessionPlayer {
    return { id: reader.varuint(), name: reader.string(MAX_NAME_BYTES) };
}
export function encodeHello(hello: HelloMessage): Uint8Array {
    const writer = new ByteWriter().u8(MESSAGE.hello).u16(hello.protocol).string(hello.schema).string(hello.name).string(hello.resumeToken);
    writeNetValue(writer, hello.ticket);
    return writer.toBytes();
}
export function decodeHello(reader: ByteReader): HelloMessage {
    const protocol = reader.u16();
    const schema = reader.string(MAX_TOKEN_BYTES);
    const name = reader.string(MAX_NAME_BYTES);
    const resumeToken = reader.string(MAX_TOKEN_BYTES);
    return { protocol, schema, name, resumeToken, ticket: readNetValue(reader) };
}
export function encodeWelcome(welcome: WelcomeMessage): Uint8Array {
    const writer = new ByteWriter()
        .u8(MESSAGE.welcome)
        .varuint(welcome.clientId)
        .u8(welcome.tickRate)
        .u8(welcome.sendRate)
        .u32(welcome.tick)
        .bool(welcome.resumed)
        .string(welcome.resumeToken)
        .string(welcome.sessionId)
        .varuint(welcome.players.length);
    for (const player of welcome.players)
        writePlayer(writer, player);
    return writer.toBytes();
}
export function decodeWelcome(reader: ByteReader): WelcomeMessage {
    const clientId = reader.varuint();
    const tickRate = reader.u8();
    const sendRate = reader.u8();
    const tick = reader.u32();
    const resumed = reader.bool();
    const resumeToken = reader.string(MAX_TOKEN_BYTES);
    const sessionId = reader.string(MAX_NAME_BYTES);
    const count = reader.varuint();
    if (tickRate === 0 || sendRate === 0 || count > MAX_ROSTER_SIZE)
        throw new WireError('welcome carries an impossible session');
    const players: SessionPlayer[] = [];
    for (let index = 0; index < count; index++)
        players.push(readPlayer(reader));
    return { clientId, tickRate, sendRate, tick, resumed, resumeToken, sessionId, players };
}
export function encodePlayerJoined(player: SessionPlayer): Uint8Array {
    const writer = new ByteWriter().u8(MESSAGE.playerJoined);
    writePlayer(writer, player);
    return writer.toBytes();
}
export function decodePlayerJoined(reader: ByteReader): SessionPlayer {
    return readPlayer(reader);
}
export function encodePlayerLeft(playerId: number, reason: string): Uint8Array {
    return new ByteWriter().u8(MESSAGE.playerLeft).varuint(playerId).string(reason).toBytes();
}
export function decodePlayerLeft(reader: ByteReader): {
    readonly playerId: number;
    readonly reason: string;
} {
    return { playerId: reader.varuint(), reason: reader.string(MAX_REASON_BYTES) };
}
export function encodePing(clientSentAt: number): Uint8Array {
    return new ByteWriter().u8(MESSAGE.ping).f64(clientSentAt).toBytes();
}
export function encodePong(pong: PongMessage): Uint8Array {
    return new ByteWriter().u8(MESSAGE.pong).f64(pong.clientSentAt).f64(pong.serverReceivedAt).f64(pong.serverSentAt).toBytes();
}
export function decodePong(reader: ByteReader): PongMessage {
    return { clientSentAt: reader.f64(), serverReceivedAt: reader.f64(), serverSentAt: reader.f64() };
}
