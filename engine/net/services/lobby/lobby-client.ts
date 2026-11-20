import type { NetValue } from '../../wire/net-value';
import { SERVICE_DISCONNECTED_EVENT, type ServiceClient } from '../service-client';
import { isNetRecord, type NetRecord } from '../service-params';
import { ServiceError } from '../service-protocol';
import { parseSessionTicket, sessionTicketToValue, type SessionTicket } from '../session-ticket';
import { LOBBY_EVENT, parseLobby, type Lobby } from './lobby-types';
export interface LobbyCreation {
    readonly name?: string;
    readonly maxMembers?: number;
    readonly isPrivate?: boolean;
    readonly data?: NetRecord;
}
export interface LobbyChanges {
    readonly name?: string;
    readonly maxMembers?: number;
    readonly isPrivate?: boolean;
    readonly isLocked?: boolean;
    readonly data?: NetRecord;
}
export interface LobbyMemberChanges {
    readonly isReady?: boolean;
    readonly data?: NetRecord;
}
export type LobbyListener = (lobby: Lobby | null) => void;
export type LobbyStartListener = (session: SessionTicket, lobby: Lobby) => void;
function requireLobby(value: NetValue): Lobby {
    const lobby = parseLobby(value);
    if (!lobby)
        throw new ServiceError('invalid', 'o serviço devolveu um lobby malformado');
    return lobby;
}
export class LobbyClient {
    private readonly changeListeners = new Set<LobbyListener>();
    private readonly startListeners = new Set<LobbyStartListener>();
    private lobby: Lobby | null = null;
    constructor(private readonly service: ServiceClient) {
        service.on(LOBBY_EVENT.changed, (payload) => this.adopt(parseLobby(payload)));
        service.on(LOBBY_EVENT.left, () => this.adopt(null));
        service.on(SERVICE_DISCONNECTED_EVENT, () => this.adopt(null));
        service.on(LOBBY_EVENT.started, (payload) => this.announceStart(payload));
    }
    get current(): Lobby | null {
        return this.lobby;
    }
    get isHost(): boolean {
        return this.lobby !== null && this.lobby.hostId === this.service.memberId;
    }
    create(creation: LobbyCreation = {}): Promise<Lobby> {
        return this.enter('lobby.create', { ...creation });
    }
    join(lobbyId: string): Promise<Lobby> {
        return this.enter('lobby.join', { lobbyId });
    }
    joinByCode(code: string): Promise<Lobby> {
        return this.enter('lobby.joinByCode', { code });
    }
    quickJoin(filter: NetRecord = {}): Promise<Lobby> {
        return this.enter('lobby.quickJoin', { filter });
    }
    async leave(): Promise<void> {
        await this.service.request('lobby.leave');
        this.adopt(null);
    }
    async list(filter: NetRecord = {}, limit = 50): Promise<Lobby[]> {
        const listed = await this.service.request('lobby.list', { filter, limit });
        return Array.isArray(listed) ? listed.map(requireLobby) : [];
    }
    update(changes: LobbyChanges): Promise<Lobby> {
        return this.enter('lobby.update', { ...changes });
    }
    setMember(changes: LobbyMemberChanges): Promise<Lobby> {
        return this.enter('lobby.setMember', { ...changes });
    }
    kick(memberId: string): Promise<Lobby> {
        return this.enter('lobby.kick', { memberId });
    }
    transferHost(memberId: string): Promise<Lobby> {
        return this.enter('lobby.transferHost', { memberId });
    }
    async start(session?: SessionTicket): Promise<SessionTicket> {
        const reply = await this.service.request('lobby.start', session ? { session: sessionTicketToValue(session) } : {});
        const ticket = isNetRecord(reply) ? parseSessionTicket(reply.session) : null;
        if (!ticket)
            throw new ServiceError('invalid', 'o serviço não devolveu a sessão do lobby');
        return ticket;
    }
    onChanged(listener: LobbyListener): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }
    onStarted(listener: LobbyStartListener): () => void {
        this.startListeners.add(listener);
        return () => {
            this.startListeners.delete(listener);
        };
    }
    private async enter(method: string, params: NetRecord): Promise<Lobby> {
        const lobby = requireLobby(await this.service.request(method, params));
        this.adopt(lobby);
        return lobby;
    }
    private adopt(lobby: Lobby | null): void {
        this.lobby = lobby;
        for (const listener of Array.from(this.changeListeners))
            listener(lobby);
    }
    private announceStart(payload: NetValue): void {
        if (!isNetRecord(payload))
            return;
        const session = parseSessionTicket(payload.session);
        const lobby = parseLobby(payload.lobby);
        if (!session || !lobby)
            return;
        for (const listener of Array.from(this.startListeners))
            listener(session, lobby);
    }
}
