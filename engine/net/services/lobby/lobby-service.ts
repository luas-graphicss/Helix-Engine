import type { NetValue } from '../../wire/net-value';
import { createSessionToken } from '../../session/session-token';
import { createUniqueJoinCode, normalizeJoinCode } from '../join-code';
import type { ServiceMember, ServiceMethod, ServiceModule } from '../service-backend';
import { isNetRecord, readData, readFlag, readInteger, readText, requireRecord, type NetRecord } from '../service-params';
import { ServiceError } from '../service-protocol';
import { parseSessionTicket, sessionTicketToValue, type SessionAllocator, type SessionTicket } from '../session-ticket';
import { LOBBY_EVENT, MAX_LOBBY_NAME_LENGTH, type LobbyLimits } from './lobby-types';
interface Seat {
    readonly member: ServiceMember;
    isReady: boolean;
    data: NetRecord;
}
interface LobbyRecord {
    readonly id: string;
    readonly code: string;
    name: string;
    hostId: string;
    maxMembers: number;
    isPrivate: boolean;
    isLocked: boolean;
    data: NetRecord;
    readonly seats: Seat[];
}
const MAX_LISTED_LOBBIES = 50;
function describe(lobby: LobbyRecord): NetRecord {
    return {
        id: lobby.id,
        code: lobby.code,
        name: lobby.name,
        hostId: lobby.hostId,
        maxMembers: lobby.maxMembers,
        isPrivate: lobby.isPrivate,
        isLocked: lobby.isLocked,
        data: lobby.data,
        members: lobby.seats.map((seat) => ({ id: seat.member.id, name: seat.member.name, isReady: seat.isReady, data: seat.data })),
    };
}
function matchesFilter(lobby: LobbyRecord, filter: NetRecord): boolean {
    return Object.entries(filter).every(([key, expected]) => JSON.stringify(lobby.data[key] ?? null) === JSON.stringify(expected));
}
function isJoinable(lobby: LobbyRecord): boolean {
    return !lobby.isLocked && lobby.seats.length < lobby.maxMembers;
}
export class LobbyService implements ServiceModule {
    readonly methods: Readonly<Record<string, ServiceMethod>>;
    private readonly lobbies = new Map<string, LobbyRecord>();
    private readonly idsByCode = new Map<string, string>();
    private readonly lobbyOfMember = new Map<string, LobbyRecord>();
    constructor(private readonly limits: LobbyLimits, private readonly allocateSession: SessionAllocator) {
        this.methods = {
            'lobby.create': (member, params) => this.create(member, requireRecord(params)),
            'lobby.join': (member, params) => this.join(member, this.lobbies.get(readText(requireRecord(params), 'lobbyId', { maxLength: 64 }))),
            'lobby.joinByCode': (member, params) => this.join(member, this.findByCode(readText(requireRecord(params), 'code', { maxLength: 16 }))),
            'lobby.quickJoin': (member, params) => this.join(member, this.findOpen(readData(requireRecord(params), 'filter'))),
            'lobby.leave': (member) => this.leave(member),
            'lobby.list': (_member, params) => this.list(requireRecord(params)),
            'lobby.update': (member, params) => this.update(member, requireRecord(params)),
            'lobby.setMember': (member, params) => this.setMember(member, requireRecord(params)),
            'lobby.kick': (member, params) => this.kick(member, readText(requireRecord(params), 'memberId', { maxLength: 64 })),
            'lobby.transferHost': (member, params) => this.transferHost(member, readText(requireRecord(params), 'memberId', { maxLength: 64 })),
            'lobby.start': (member, params) => this.start(member, requireRecord(params)),
        };
    }
    get count(): number {
        return this.lobbies.size;
    }
    partyOf(member: ServiceMember): ServiceMember[] {
        const lobby = this.lobbyOfMember.get(member.id);
        return lobby && lobby.hostId === member.id ? lobby.seats.map((seat) => seat.member) : [member];
    }
    memberLeft(member: ServiceMember): void {
        this.removeSeat(member.id, 'disconnected');
    }
    private create(member: ServiceMember, params: NetRecord): NetValue {
        if (this.lobbyOfMember.has(member.id))
            throw new ServiceError('conflict', 'saia do lobby atual antes de criar outro');
        if (this.lobbies.size >= this.limits.maxLobbies)
            throw new ServiceError('limit', 'o servidor chegou ao máximo de lobbies');
        const lobby: LobbyRecord = {
            id: createSessionToken(),
            code: createUniqueJoinCode((code) => this.idsByCode.has(code)),
            name: readText(params, 'name', { maxLength: MAX_LOBBY_NAME_LENGTH, fallback: `Lobby de ${member.name}` }),
            hostId: member.id,
            maxMembers: readInteger(params, 'maxMembers', { min: 1, max: this.limits.maxMembers, fallback: Math.min(4, this.limits.maxMembers) }),
            isPrivate: readFlag(params, 'isPrivate', false),
            isLocked: false,
            data: readData(params, 'data'),
            seats: [],
        };
        this.lobbies.set(lobby.id, lobby);
        this.idsByCode.set(lobby.code, lobby.id);
        return this.seat(member, lobby);
    }
    private join(member: ServiceMember, lobby: LobbyRecord | undefined): NetValue {
        if (!lobby)
            throw new ServiceError('not-found', 'nenhum lobby corresponde ao pedido');
        if (this.lobbyOfMember.has(member.id))
            throw new ServiceError('conflict', 'saia do lobby atual antes de entrar em outro');
        if (lobby.isLocked)
            throw new ServiceError('forbidden', 'o lobby está trancado');
        if (lobby.seats.length >= lobby.maxMembers)
            throw new ServiceError('full', 'o lobby está cheio');
        return this.seat(member, lobby);
    }
    private seat(member: ServiceMember, lobby: LobbyRecord): NetValue {
        lobby.seats.push({ member, isReady: false, data: {} });
        this.lobbyOfMember.set(member.id, lobby);
        this.announce(lobby);
        return describe(lobby);
    }
    private leave(member: ServiceMember): NetValue {
        return this.removeSeat(member.id, 'left');
    }
    private list(params: NetRecord): NetValue {
        const filter = readData(params, 'filter');
        const limit = readInteger(params, 'limit', { min: 1, max: MAX_LISTED_LOBBIES, fallback: MAX_LISTED_LOBBIES });
        const listed: NetValue[] = [];
        for (const lobby of this.lobbies.values()) {
            if (listed.length >= limit)
                break;
            if (!lobby.isPrivate && isJoinable(lobby) && matchesFilter(lobby, filter))
                listed.push(describe(lobby));
        }
        return listed;
    }
    private update(member: ServiceMember, params: NetRecord): NetValue {
        const lobby = this.hostedBy(member);
        lobby.name = readText(params, 'name', { maxLength: MAX_LOBBY_NAME_LENGTH, fallback: lobby.name });
        lobby.maxMembers = readInteger(params, 'maxMembers', { min: Math.max(1, lobby.seats.length), max: this.limits.maxMembers, fallback: lobby.maxMembers });
        lobby.isPrivate = readFlag(params, 'isPrivate', lobby.isPrivate);
        lobby.isLocked = readFlag(params, 'isLocked', lobby.isLocked);
        if (params.data !== undefined)
            lobby.data = readData(params, 'data');
        this.announce(lobby);
        return describe(lobby);
    }
    private setMember(member: ServiceMember, params: NetRecord): NetValue {
        const lobby = this.lobbyOf(member);
        const seat = lobby.seats.find((entry) => entry.member.id === member.id);
        if (!seat)
            throw new ServiceError('not-found', 'você não está neste lobby');
        seat.isReady = readFlag(params, 'isReady', seat.isReady);
        if (params.data !== undefined)
            seat.data = readData(params, 'data');
        this.announce(lobby);
        return describe(lobby);
    }
    private kick(member: ServiceMember, targetId: string): NetValue {
        const lobby = this.hostedBy(member);
        if (targetId === member.id || !lobby.seats.some((seat) => seat.member.id === targetId))
            throw new ServiceError('not-found', 'esse membro não está no lobby');
        this.removeSeat(targetId, 'kicked');
        return describe(lobby);
    }
    private transferHost(member: ServiceMember, targetId: string): NetValue {
        const lobby = this.hostedBy(member);
        if (!lobby.seats.some((seat) => seat.member.id === targetId))
            throw new ServiceError('not-found', 'esse membro não está no lobby');
        lobby.hostId = targetId;
        this.announce(lobby);
        return describe(lobby);
    }
    private start(member: ServiceMember, params: NetRecord): NetValue {
        const lobby = this.hostedBy(member);
        const requested = isNetRecord(params.session) ? parseSessionTicket(params.session) : null;
        const ticket: SessionTicket = requested?.mode === 'relay' ? requested : { mode: 'dedicated', sessionId: this.allocateSession(lobby.maxMembers) };
        lobby.isLocked = true;
        const payload = { lobby: describe(lobby), session: sessionTicketToValue(ticket) };
        for (const seat of lobby.seats)
            seat.member.notify(LOBBY_EVENT.started, payload);
        return payload;
    }
    private findByCode(code: string): LobbyRecord | undefined {
        const id = this.idsByCode.get(normalizeJoinCode(code));
        return id === undefined ? undefined : this.lobbies.get(id);
    }
    private findOpen(filter: NetRecord): LobbyRecord | undefined {
        let best: LobbyRecord | undefined;
        for (const lobby of this.lobbies.values())
            if (!lobby.isPrivate && isJoinable(lobby) && matchesFilter(lobby, filter) && (!best || lobby.seats.length > best.seats.length))
                best = lobby;
        return best;
    }
    private lobbyOf(member: ServiceMember): LobbyRecord {
        const lobby = this.lobbyOfMember.get(member.id);
        if (!lobby)
            throw new ServiceError('not-found', 'você não está em um lobby');
        return lobby;
    }
    private hostedBy(member: ServiceMember): LobbyRecord {
        const lobby = this.lobbyOf(member);
        if (lobby.hostId !== member.id)
            throw new ServiceError('forbidden', 'só o anfitrião pode fazer isso');
        return lobby;
    }
    private removeSeat(memberId: string, reason: string): NetValue {
        const lobby = this.lobbyOfMember.get(memberId);
        const index = lobby?.seats.findIndex((seat) => seat.member.id === memberId) ?? -1;
        if (!lobby || index < 0)
            return null;
        const [seat] = lobby.seats.splice(index, 1);
        this.lobbyOfMember.delete(memberId);
        seat.member.notify(LOBBY_EVENT.left, { lobbyId: lobby.id, reason });
        if (lobby.seats.length === 0) {
            this.lobbies.delete(lobby.id);
            this.idsByCode.delete(lobby.code);
            return null;
        }
        if (lobby.hostId === memberId)
            lobby.hostId = lobby.seats[0].member.id;
        this.announce(lobby);
        return null;
    }
    private announce(lobby: LobbyRecord): void {
        const snapshot = describe(lobby);
        for (const seat of lobby.seats)
            seat.member.notify(LOBBY_EVENT.changed, snapshot);
    }
}
