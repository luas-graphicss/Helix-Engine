import { DEFAULT_CONNECTION_OPTIONS, type ConnectionOptions } from '../connection/connection';
import type { NetworkObjectInit } from '../objects/network-object';
import type { QueueConfig } from '../services/matchmaking/matchmaking-types';
import type { MultiplayerSettings } from '../settings/multiplayer-settings';
export type SceneObjectSeed = Omit<NetworkObjectInit, 'id' | 'ownerId'> & {
    readonly sceneId: number;
};
export interface MultiplayerServerConfig {
    readonly schema: string;
    readonly tickRate: number;
    readonly sendRate: number;
    readonly maxPlayers: number;
    readonly reconnectGraceMs: number;
    readonly maxSessions: number;
    readonly emptySessionMs: number;
    readonly openSessions: boolean;
    readonly lobbyEnabled: boolean;
    readonly maxLobbyMembers: number;
    readonly queues: readonly QueueConfig[];
    readonly relayEnabled: boolean;
    readonly sceneObjects: readonly SceneObjectSeed[];
    readonly connection: ConnectionOptions;
}
export interface SessionRules {
    readonly tickRate: number;
    readonly maxPlayers: number;
}
export const MAX_MESSAGES_PER_SECOND = 300;
export const MAX_VIOLATIONS = 40;
export function createServerConfig(settings: MultiplayerSettings, rules: SessionRules, schema: string, sceneObjects: readonly SceneObjectSeed[]): MultiplayerServerConfig {
    return {
        schema,
        tickRate: rules.tickRate,
        sendRate: Math.min(settings.sendRate, rules.tickRate),
        maxPlayers: rules.maxPlayers,
        reconnectGraceMs: settings.reconnectGraceSeconds * 1000,
        maxSessions: settings.server.maxSessions,
        emptySessionMs: settings.server.emptySessionSeconds * 1000,
        openSessions: settings.server.openSessions,
        lobbyEnabled: settings.lobby.enabled,
        maxLobbyMembers: settings.lobby.maxMembers,
        queues: settings.matchmaking.enabled ? settings.matchmaking.queues : [],
        relayEnabled: settings.relay.enabled,
        sceneObjects,
        connection: DEFAULT_CONNECTION_OPTIONS,
    };
}
