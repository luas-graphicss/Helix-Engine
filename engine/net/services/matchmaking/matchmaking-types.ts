import type { NetValue } from '../../wire/net-value';
import { isNetRecord } from '../service-params';
import { parseSessionTicket, type SessionTicket } from '../session-ticket';
export interface QueueConfig {
    readonly name: string;
    readonly teamSize: number;
    readonly teamCount: number;
    readonly skillWindow: number;
    readonly skillGrowthPerSecond: number;
    readonly maxWaitSeconds: number;
    readonly minPlayers: number;
}
export interface MatchPlayer {
    readonly id: string;
    readonly name: string;
    readonly team: number;
}
export interface MatchFound {
    readonly matchId: string;
    readonly queue: string;
    readonly team: number;
    readonly players: MatchPlayer[];
    readonly session: SessionTicket;
}
export const MATCH_EVENT = {
    found: 'match.found',
    expired: 'match.expired',
} as const;
export const MAX_QUEUE_NAME_LENGTH = 32;
export const MAX_TEAM_SIZE = 32;
export const MAX_TEAM_COUNT = 16;
export const DEFAULT_QUEUE: QueueConfig = { name: 'casual', teamSize: 1, teamCount: 2, skillWindow: 100, skillGrowthPerSecond: 25, maxWaitSeconds: 60, minPlayers: 2 };
function clampInteger(value: number, min: number, max: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}
export function normalizeQueue(queue: Partial<QueueConfig>): QueueConfig {
    const teamSize = clampInteger(queue.teamSize ?? DEFAULT_QUEUE.teamSize, 1, MAX_TEAM_SIZE);
    const teamCount = clampInteger(queue.teamCount ?? DEFAULT_QUEUE.teamCount, 1, MAX_TEAM_COUNT);
    return {
        name: (queue.name ?? DEFAULT_QUEUE.name).trim().slice(0, MAX_QUEUE_NAME_LENGTH) || DEFAULT_QUEUE.name,
        teamSize,
        teamCount,
        skillWindow: Math.max(0, queue.skillWindow ?? DEFAULT_QUEUE.skillWindow),
        skillGrowthPerSecond: Math.max(0, queue.skillGrowthPerSecond ?? DEFAULT_QUEUE.skillGrowthPerSecond),
        maxWaitSeconds: Math.max(1, queue.maxWaitSeconds ?? DEFAULT_QUEUE.maxWaitSeconds),
        minPlayers: clampInteger(queue.minPlayers ?? teamSize * teamCount, 1, teamSize * teamCount),
    };
}
function parsePlayer(value: NetValue): MatchPlayer | null {
    if (!isNetRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.team !== 'number')
        return null;
    return { id: value.id, name: value.name, team: value.team };
}
export function parseMatchFound(value: NetValue | undefined): MatchFound | null {
    if (!isNetRecord(value) || typeof value.matchId !== 'string' || typeof value.queue !== 'string' || typeof value.team !== 'number' || !Array.isArray(value.players))
        return null;
    const session = parseSessionTicket(value.session);
    const players = value.players.map(parsePlayer);
    if (!session || players.includes(null))
        return null;
    return { matchId: value.matchId, queue: value.queue, team: value.team, session, players: players.filter((player) => player !== null) };
}
