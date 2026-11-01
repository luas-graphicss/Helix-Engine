export const HELIX_NET_PROTOCOL = 1;
export const SERVER_PEER = 0;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type JsonRecord = {
    [key: string]: JsonValue;
};
export interface NetPlayerInfo {
    readonly id: number;
    readonly name: string;
    readonly joinedAt: number;
}
export type NetMessage = {
    t: 'hello';
    protocol: number;
    name: string;
    ticket: JsonValue | null;
} | {
    t: 'welcome';
    player: NetPlayerInfo;
    players: NetPlayerInfo[];
    state: JsonRecord;
    tickRate: number;
    serverTime: number;
} | {
    t: 'reject';
    reason: string;
} | {
    t: 'call';
    id: number;
    name: string;
    args: JsonValue[];
} | {
    t: 'result';
    id: number;
    ok: true;
    value: JsonValue;
} | {
    t: 'result';
    id: number;
    ok: false;
    error: string;
} | {
    t: 'event';
    name: string;
    args: JsonValue[];
} | {
    t: 'state';
    set: JsonRecord;
    removed: string[];
} | {
    t: 'replicate';
    entities: Array<{
        id: number;
        name: string;
        fields: JsonRecord;
    }>;
} | {
    t: 'playerJoined';
    player: NetPlayerInfo;
} | {
    t: 'playerLeft';
    player: NetPlayerInfo;
    reason: string;
} | {
    t: 'kick';
    reason: string;
} | {
    t: 'ping';
    at: number;
} | {
    t: 'pong';
    at: number;
    serverTime: number;
};
export type NetMessageType = NetMessage['t'];
export const LEFT_REASON_DISCONNECTED = 'desconectou';
export const MAX_MESSAGE_BYTES = 256 * 1024;
export function isNetMessage(value: unknown): value is NetMessage {
    return typeof value === 'object' && value !== null && typeof (value as {
        t?: unknown;
    }).t === 'string';
}
export function encodeMessage(message: NetMessage): string {
    return JSON.stringify(message);
}
export function decodeMessage(text: string): NetMessage | null {
    try {
        const parsed: unknown = JSON.parse(text);
        return isNetMessage(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
