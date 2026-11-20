import type { LobbyChanges, LobbyCreation } from '@/engine/net/services/lobby/lobby-client';
import type { Lobby } from '@/engine/net/services/lobby/lobby-types';
import type { SessionTicket } from '@/engine/net/services/session-ticket';
import { optionalNumber, requireObject, requireString } from '../../runtime/values';
import { listen, optionalCount, optionalFlag, optionalRecord, optionalText, requireActive, settled, type MultiplayerApiContext } from './multiplayer-context';
interface LobbyStart {
    readonly ticket: SessionTicket;
    readonly lobby: Lobby;
}
const CHANGED_EVENT = 'multiplayer.lobby.changed';
const STARTED_EVENT = 'multiplayer.lobby.started';
const DEFAULT_LIST_LIMIT = 50;
const API = 'helix.multiplayer.lobby';
function creationFrom(options: unknown, member: string): LobbyCreation {
    if (options === undefined)
        return {};
    const record = requireObject(options, member);
    return {
        name: optionalText(record.name, member, 'o nome do lobby'),
        maxMembers: optionalCount(record.maxMembers, member, 'o máximo de membros'),
        isPrivate: optionalFlag(record.isPrivate, member, 'a opção isPrivate'),
        data: optionalRecord(record.data, member, 'os dados do lobby'),
    };
}
function changesFrom(options: unknown, member: string): LobbyChanges {
    const record = requireObject(options, member, 'as mudanças');
    return { ...creationFrom(record, member), isLocked: optionalFlag(record.isLocked, member, 'a opção isLocked') };
}
export function createLobbyApi({ host, runtime }: MultiplayerApiContext) {
    const { lobby } = runtime;
    if (lobby) {
        host.disposers.add(lobby.onChanged((current) => void host.bus.emit(CHANGED_EVENT, current)));
        host.disposers.add(lobby.onStarted((ticket, current) => void host.bus.emit(STARTED_EVENT, { ticket, lobby: current })));
    }
    const active = (member: string) => requireActive(runtime.lobby, member);
    return {
        get current() {
            return runtime.lobby?.current ?? null;
        },
        get isHost() {
            return runtime.lobby?.isHost ?? false;
        },
        create: (options?: unknown) => settled(`${API}.create`, () => active(`${API}.create`).create(creationFrom(options, `${API}.create`))),
        join: (lobbyId: unknown) => settled(`${API}.join`, () => active(`${API}.join`).join(requireString(lobbyId, `${API}.join`, 'o id do lobby'))),
        joinByCode: (code: unknown) => settled(`${API}.joinByCode`, () => active(`${API}.joinByCode`).joinByCode(requireString(code, `${API}.joinByCode`, 'o código do lobby'))),
        quickJoin: (filter?: unknown) => settled(`${API}.quickJoin`, () => active(`${API}.quickJoin`).quickJoin(optionalRecord(filter, `${API}.quickJoin`, 'o filtro') ?? {})),
        list: (filter?: unknown, limit?: unknown) => settled(`${API}.list`, () => active(`${API}.list`).list(optionalRecord(filter, `${API}.list`, 'o filtro') ?? {}, optionalNumber(limit, DEFAULT_LIST_LIMIT, `${API}.list`, 'o limite'))),
        leave: () => settled(`${API}.leave`, () => active(`${API}.leave`).leave()),
        update: (changes: unknown) => settled(`${API}.update`, () => active(`${API}.update`).update(changesFrom(changes, `${API}.update`))),
        setReady: (ready: unknown) => settled(`${API}.setReady`, () => active(`${API}.setReady`).setMember({ isReady: ready === true })),
        setData: (data: unknown) => settled(`${API}.setData`, () => active(`${API}.setData`).setMember({ data: optionalRecord(data, `${API}.setData`, 'os dados do membro') ?? {} })),
        kick: (memberId: unknown) => settled(`${API}.kick`, () => active(`${API}.kick`).kick(requireString(memberId, `${API}.kick`, 'o id do membro'))),
        transferHost: (memberId: unknown) => settled(`${API}.transferHost`, () => active(`${API}.transferHost`).transferHost(requireString(memberId, `${API}.transferHost`, 'o id do membro'))),
        start: () => settled(`${API}.start`, () => runtime.startLobby()),
        onChanged: (handler: unknown) => listen<Lobby | null>(host, CHANGED_EVENT, handler, `${API}.onChanged`, (current) => [current]),
        onStarted: (handler: unknown) => listen<LobbyStart>(host, STARTED_EVENT, handler, `${API}.onStarted`, (start) => [start.ticket, start.lobby]),
    };
}
