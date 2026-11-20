import { DEFAULT_QUEUE, normalizeQueue, type QueueConfig } from '../services/matchmaking/matchmaking-types';
import { normalizeRpcDeclarations, type RpcDeclaration } from './rpc-declarations';
export type SessionTopology = 'dedicated' | 'relay';
export interface MultiplayerSettings {
    enabled: boolean;
    topology: SessionTopology;
    sendRate: number;
    autoJoin: boolean;
    defaultSession: string;
    reconnectGraceSeconds: number;
    lobby: {
        enabled: boolean;
        maxMembers: number;
    };
    matchmaking: {
        enabled: boolean;
        queues: QueueConfig[];
    };
    relay: {
        enabled: boolean;
    };
    server: {
        maxSessions: number;
        emptySessionSeconds: number;
        openSessions: boolean;
    };
    rpcs: RpcDeclaration[];
}
export const SESSION_TOPOLOGIES: readonly SessionTopology[] = ['dedicated', 'relay'];
export const SESSION_TOPOLOGY_LABEL: Record<SessionTopology, string> = {
    dedicated: 'Servidor dedicado',
    relay: 'Jogador anfitrião',
};
export const SESSION_TOPOLOGY_HINT: Record<SessionTopology, string> = {
    dedicated: 'A sessão roda no servidor hospedado, que tem a palavra final sobre os objetos de rede.',
    relay: 'Um jogador hospeda a sessão no próprio jogo e os outros entram por um código; o servidor hospedado só repassa os pacotes.',
};
export const SEND_RATES: readonly number[] = [10, 15, 20, 30, 60];
export const DEFAULT_SESSION_NAME = 'principal';
export const MAX_SESSION_NAME_LENGTH = 48;
export const MAX_QUEUES = 8;
export const MAX_SERVER_SESSIONS = 1024;
export const MAX_LOBBY_MEMBERS = 64;
const SESSION_NAME_PATTERN = /[^a-zA-Z0-9_-]/g;
export function createMultiplayerSettings(): MultiplayerSettings {
    return {
        enabled: false,
        topology: 'dedicated',
        sendRate: 20,
        autoJoin: true,
        defaultSession: DEFAULT_SESSION_NAME,
        reconnectGraceSeconds: 15,
        lobby: { enabled: true, maxMembers: 8 },
        matchmaking: { enabled: true, queues: [{ ...DEFAULT_QUEUE }] },
        relay: { enabled: true },
        server: { maxSessions: 64, emptySessionSeconds: 60, openSessions: true },
        rpcs: [],
    };
}
export function normalizeSessionName(name: string): string {
    return name.replace(SESSION_NAME_PATTERN, '').slice(0, MAX_SESSION_NAME_LENGTH) || DEFAULT_SESSION_NAME;
}
function clamp(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}
function nearestSendRate(value: number): number {
    return SEND_RATES.reduce((best, rate) => (Math.abs(rate - value) < Math.abs(best - value) ? rate : best), SEND_RATES[0]);
}
function uniqueQueues(queues: readonly Partial<QueueConfig>[]): QueueConfig[] {
    const byName = new Map<string, QueueConfig>();
    for (const queue of queues.slice(0, MAX_QUEUES)) {
        const normalized = normalizeQueue(queue);
        if (!byName.has(normalized.name))
            byName.set(normalized.name, normalized);
    }
    return Array.from(byName.values());
}
export function normalizeMultiplayerSettings(settings: MultiplayerSettings): MultiplayerSettings {
    const defaults = createMultiplayerSettings();
    return {
        enabled: settings.enabled === true,
        topology: SESSION_TOPOLOGIES.includes(settings.topology) ? settings.topology : defaults.topology,
        sendRate: nearestSendRate(Number(settings.sendRate)),
        autoJoin: settings.autoJoin !== false,
        defaultSession: normalizeSessionName(String(settings.defaultSession ?? '')),
        reconnectGraceSeconds: clamp(Number(settings.reconnectGraceSeconds), 0, 120, defaults.reconnectGraceSeconds),
        lobby: { enabled: settings.lobby?.enabled !== false, maxMembers: clamp(Number(settings.lobby?.maxMembers), 1, MAX_LOBBY_MEMBERS, defaults.lobby.maxMembers) },
        matchmaking: { enabled: settings.matchmaking?.enabled !== false, queues: uniqueQueues(Array.isArray(settings.matchmaking?.queues) ? settings.matchmaking.queues : defaults.matchmaking.queues) },
        relay: { enabled: settings.relay?.enabled !== false },
        server: {
            maxSessions: clamp(Number(settings.server?.maxSessions), 1, MAX_SERVER_SESSIONS, defaults.server.maxSessions),
            emptySessionSeconds: clamp(Number(settings.server?.emptySessionSeconds), 5, 3600, defaults.server.emptySessionSeconds),
            openSessions: settings.server?.openSessions !== false,
        },
        rpcs: normalizeRpcDeclarations(Array.isArray(settings.rpcs) ? settings.rpcs : []),
    };
}
