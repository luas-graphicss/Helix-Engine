import type { NetValue } from '../../wire/net-value';
import { isNetRecord, type NetRecord } from '../service-params';
export interface LobbyMember {
    readonly id: string;
    readonly name: string;
    readonly isReady: boolean;
    readonly data: NetRecord;
}
export interface Lobby {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly hostId: string;
    readonly maxMembers: number;
    readonly isPrivate: boolean;
    readonly isLocked: boolean;
    readonly data: NetRecord;
    readonly members: LobbyMember[];
}
export interface LobbyLimits {
    readonly maxLobbies: number;
    readonly maxMembers: number;
}
export const DEFAULT_LOBBY_LIMITS: LobbyLimits = { maxLobbies: 500, maxMembers: 16 };
export const MAX_LOBBY_NAME_LENGTH = 48;
export const LOBBY_EVENT = {
    changed: 'lobby.changed',
    left: 'lobby.left',
    started: 'lobby.started',
} as const;
function parseMember(value: NetValue): LobbyMember | null {
    if (!isNetRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.isReady !== 'boolean' || !isNetRecord(value.data))
        return null;
    return { id: value.id, name: value.name, isReady: value.isReady, data: value.data };
}
export function parseLobby(value: NetValue | undefined): Lobby | null {
    if (!isNetRecord(value) || !Array.isArray(value.members) || !isNetRecord(value.data))
        return null;
    const { id, code, name, hostId, maxMembers, isPrivate, isLocked } = value;
    if (typeof id !== 'string' || typeof code !== 'string' || typeof name !== 'string' || typeof hostId !== 'string' || typeof maxMembers !== 'number' || typeof isPrivate !== 'boolean' || typeof isLocked !== 'boolean')
        return null;
    const members: LobbyMember[] = [];
    for (const entry of value.members) {
        const member = parseMember(entry);
        if (!member)
            return null;
        members.push(member);
    }
    return { id, code, name, hostId, maxMembers, isPrivate, isLocked, data: value.data, members };
}
