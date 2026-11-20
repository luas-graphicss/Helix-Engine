import { DEFAULT_CONNECTION_OPTIONS } from '@/engine/net/connection/connection';
import { LocalBackend } from '@/engine/net/server/local-backend';
import { createServerConfig } from '@/engine/net/server/server-config';
import { createIdleDelegate } from '@/engine/net/server/session-delegate';
import { LobbyClient } from '@/engine/net/services/lobby/lobby-client';
import { MatchmakingClient } from '@/engine/net/services/matchmaking/matchmaking-client';
import { normalizeQueue } from '@/engine/net/services/matchmaking/matchmaking-types';
import { allocateRelay } from '@/engine/net/services/relay/relay-client';
import { RelayHostLink } from '@/engine/net/services/relay/relay-host-link';
import { ServiceClient } from '@/engine/net/services/service-client';
import { ServiceError } from '@/engine/net/services/service-protocol';
import type { SessionTicket } from '@/engine/net/services/session-ticket';
import { NetClient } from '@/engine/net/session/net-client';
import { NetServer } from '@/engine/net/session/net-server';
import { createMultiplayerSettings } from '@/engine/net/settings/multiplayer-settings';
import { createTransformState } from '@/engine/net/sync/transform-state';
import { DISCONNECT } from '@/engine/net/transport/disconnect-reason';
import { PERFECT_CONDITIONS } from '@/engine/net/transport/network-conditions';
import { createCheckList } from '../support/check-list';
import { seededRandom } from './net-test-support';
const checks = createCheckList('Serviços: lobby, matchmaking, relay e servidor dedicado');
const SCHEMA = 'schema-a';
const settings = createMultiplayerSettings();
const config = createServerConfig({
    ...settings,
    enabled: true,
    lobby: { enabled: true, maxMembers: 3 },
    matchmaking: {
        enabled: true,
        queues: [
            normalizeQueue({ name: 'duel', teamSize: 1, teamCount: 2, skillWindow: 100, skillGrowthPerSecond: 50, maxWaitSeconds: 10 }),
            normalizeQueue({ name: 'squad', teamSize: 2, teamCount: 2, skillWindow: 1000, maxWaitSeconds: 30 }),
            normalizeQueue({ name: 'flex', teamSize: 2, teamCount: 2, skillWindow: 1000, maxWaitSeconds: 4, minPlayers: 2 }),
        ],
    },
    server: { maxSessions: 4, emptySessionSeconds: 5, openSessions: true },
}, { tickRate: 30, maxPlayers: 4 }, SCHEMA, [{ sceneId: 7, kind: 'door', transform: createTransformState(), variables: [{ name: 'open', initial: false, writer: 'server' }] }]);
const backend = new LocalBackend(config, PERFECT_CONDITIONS, () => createIdleDelegate(), seededRandom(5));
interface Member {
    readonly service: ServiceClient;
    readonly lobby: LobbyClient;
    readonly matchmaking: MatchmakingClient;
    readonly started: SessionTicket[];
}
function member(name: string): Member {
    const service = new ServiceClient(() => backend.openServices(), name, 2000);
    const lobby = new LobbyClient(service);
    const started: SessionTicket[] = [];
    lobby.onStarted((session) => started.push(session));
    return { service, lobby, matchmaking: new MatchmakingClient(service), started };
}
function nextTask(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
async function settle(advanceMs = 0): Promise<void> {
    await nextTask();
    backend.advance(advanceMs);
    await nextTask();
}
async function codeOf(action: Promise<unknown>): Promise<string> {
    try {
        await action;
        return 'ok';
    }
    catch (error) {
        if (error instanceof ServiceError)
            return error.code;
        throw error;
    }
}
const ana = member('Ana');
const bia = member('Bia');
const caio = member('Caio');
const davi = member('Davi');
const room = await ana.lobby.create({ name: 'Sala da Ana', maxMembers: 3, data: { map: 'floresta' } });
checks.check('criar lobby devolve código curto e põe o criador como anfitrião', room.code.length === 6 && room.hostId === ana.service.memberId && ana.lobby.isHost && room.members.length === 1);
checks.check('estar em um lobby impede criar outro', (await codeOf(ana.lobby.create())) === 'conflict');
checks.check('parâmetro fora da faixa é recusado', (await codeOf(davi.lobby.create({ maxMembers: 99 }))) === 'invalid');
const hidden = await davi.lobby.create({ name: 'Privado', isPrivate: true });
const listed = await bia.lobby.list();
checks.check('a lista mostra só os lobbies públicos', listed.length === 1 && listed[0].id === room.id && listed[0].data.map === 'floresta');
checks.check('a lista filtra pelos dados do lobby', (await bia.lobby.list({ map: 'deserto' })).length === 0 && (await bia.lobby.list({ map: 'floresta' })).length === 1);
await bia.lobby.joinByCode(` ${room.code.toLowerCase()} `);
await settle();
checks.check('entrar pelo código avisa quem já estava', ana.lobby.current?.members.length === 2 && bia.lobby.current?.id === room.id && !bia.lobby.isHost);
checks.check('só o anfitrião altera o lobby', (await codeOf(bia.lobby.update({ name: 'Da Bia' }))) === 'forbidden');
await caio.lobby.quickJoin({ map: 'floresta' });
await davi.lobby.leave();
checks.check('lobby cheio recusa mais um', (await codeOf(davi.lobby.join(room.id))) === 'full');
checks.check('lobby privado vazio deixa de existir', (await codeOf(bia.service.request('lobby.joinByCode', { code: hidden.code }))) === 'not-found');
await bia.lobby.setMember({ isReady: true, data: { hero: 'maga' } });
await ana.lobby.update({ data: { map: 'deserto' } });
await settle();
const seenByCaio = caio.lobby.current;
checks.check('prontidão e dados chegam a todos os membros', seenByCaio?.members.find((entry) => entry.name === 'Bia')?.isReady === true && seenByCaio.data.map === 'deserto');
await ana.lobby.kick(caio.service.memberId);
await settle();
checks.check('expulsar tira o membro e avisa a ele', caio.lobby.current === null && ana.lobby.current?.members.length === 2);
const ticket = await ana.lobby.start();
await settle();
checks.check('iniciar reserva uma sessão e entrega a mesma a todos', ticket.mode === 'dedicated' && JSON.stringify(bia.started) === JSON.stringify([ticket]) && ana.started.length === 1);
checks.check('a sessão reservada já existe no servidor', ticket.mode === 'dedicated' && backend.server.sessionOf(ticket.sessionId) !== undefined && backend.server.status().lobbies === 1);
checks.check('lobby iniciado fica trancado', (await codeOf(caio.lobby.join(room.id))) === 'forbidden');
await ana.lobby.leave();
await settle();
checks.check('quando o anfitrião sai outro assume', bia.lobby.isHost && bia.lobby.current?.members.length === 1);
const relayed = await bia.lobby.start({ mode: 'relay', joinCode: 'ABC234' });
checks.check('iniciar por relay repassa o código do anfitrião', relayed.mode === 'relay' && relayed.joinCode === 'ABC234');
bia.service.close();
await settle();
checks.check('quem perde a ligação sai do lobby e o lobby vazio some', backend.server.status().lobbies === 0 && bia.lobby.current === null);
checks.check('serviço desconhecido é recusado', (await codeOf(ana.service.request('lobby.destroy'))) === 'unknown-method');
const firstDuel = ana.matchmaking.find('duel', { skill: 1000 });
const secondDuel = caio.matchmaking.find('duel', { skill: 1050 });
await settle(600);
const [anaMatch, caioMatch] = await Promise.all([firstDuel, secondDuel]);
checks.check('dois jogadores de nível próximo formam uma partida', anaMatch.matchId === caioMatch.matchId && anaMatch.team !== caioMatch.team && anaMatch.players.length === 2 && JSON.stringify(anaMatch.session) === JSON.stringify(caioMatch.session));
const lowDuel = ana.matchmaking.find('duel', { skill: 0 });
const highDuel = caio.matchmaking.find('duel', { skill: 300 });
await settle(600);
checks.check('níveis distantes esperam a janela abrir', backend.server.status().searching === 2);
await settle(5000);
const [lowMatch] = await Promise.all([lowDuel, highDuel]);
checks.check('a janela de nível cresce com a espera', lowMatch.players.length === 2 && backend.server.status().searching === 0);
const eva = member('Eva');
await ana.lobby.create({ maxMembers: 2 });
await davi.lobby.join(ana.lobby.current?.id ?? '');
const partySearch = ana.matchmaking.find('squad', { party: true, skill: 500 });
const partnerSearches = [caio.matchmaking.find('squad', { skill: 400 }), eva.matchmaking.find('squad', { skill: 600 })];
const daviMatches: number[] = [];
davi.matchmaking.onMatched((match) => daviMatches.push(match.team));
await settle(600);
const partyMatch = await partySearch;
await Promise.all(partnerSearches);
checks.check('o grupo do lobby entra junto e fica no mesmo time', partyMatch.players.length === 4 && daviMatches.join(',') === String(partyMatch.team) && partyMatch.players.filter((player) => player.team === partyMatch.team).length === 2);
checks.check('grupo maior que o time é recusado', (await codeOf(ana.matchmaking.find('duel', { party: true }))) === 'invalid');
const flexSearches = [caio.matchmaking.find('flex'), eva.matchmaking.find('flex')];
await settle(600);
checks.check('fila incompleta espera', backend.server.status().searching === 2);
await settle(4000);
const [flexMatch] = await Promise.all(flexSearches);
checks.check('passado o tempo a fila fecha com o mínimo', flexMatch.players.length === 2);
const lonely = codeOf(caio.matchmaking.find('duel'));
await settle(21000);
checks.check('sem adversário a busca expira', (await lonely) === 'timeout' && !caio.matchmaking.isSearching);
const cancelled = codeOf(eva.matchmaking.find('duel'));
await settle();
await eva.matchmaking.cancel();
checks.check('cancelar encerra a busca', (await cancelled) === 'conflict' && backend.server.status().searching === 0);
checks.check('fila inexistente é recusada', (await codeOf(eva.matchmaking.find('ranked'))) === 'not-found');
const dropped = codeOf(eva.matchmaking.find('duel'));
await settle();
eva.service.close();
await settle();
checks.check('quem cai durante a busca sai da fila', (await dropped) === 'disconnected' && backend.server.status().searching === 0);
const clock = () => backend.timeMs;
const hostEvents: string[] = [];
const hostServer = new NetServer({ sessionId: 'anfitrião', schema: SCHEMA, tickRate: 30, sendRate: 30, maxPlayers: 4, reconnectGraceMs: 0, maxMessagesPerSecond: 240, maxViolations: 40, clock, connection: DEFAULT_CONNECTION_OPTIONS }, {
    ...createIdleDelegate(),
    playerJoined: (player) => hostEvents.push(`joined:${player.name}`),
    playerLeft: (player, reason) => hostEvents.push(`left:${player.name}:${reason}`),
});
const joinCode = await allocateRelay(ana.service, 2);
const hostEnded: string[] = [];
const hostLink = new RelayHostLink(backend.openSocket(`relay/${joinCode}/host`), (socket) => hostServer.accept(socket), (reason) => hostEnded.push(reason));
interface Guest {
    readonly client: NetClient;
    readonly events: string[];
}
const guests: Guest[] = [];
function guest(name: string, path: string): Guest {
    const events: string[] = [];
    const client = new NetClient({ name, ticket: null, schema: SCHEMA, clock, openSocket: () => backend.openSocket(path), reconnectAttempts: 2, reconnectBaseDelayMs: 100, connection: DEFAULT_CONNECTION_OPTIONS }, {
        connected: () => events.push('connected'),
        reconnecting: () => events.push('reconnecting'),
        disconnected: (reason) => events.push(`disconnected:${reason}`),
        playerJoined: () => undefined,
        playerLeft: () => undefined,
        corrected: () => undefined,
    });
    const entry = { client, events };
    guests.push(entry);
    client.start();
    return entry;
}
function play(durationMs: number): void {
    for (let elapsed = 0; elapsed < durationMs; elapsed += 8) {
        backend.advance(8);
        hostServer.update();
        for (const entry of guests)
            entry.client.update();
    }
}
const relayPath = `relay/${joinCode}/client`;
const firstGuest = guest('Convidado 1', relayPath);
const secondGuest = guest('Convidado 2', relayPath);
play(300);
checks.check('convidados entram na sessão do anfitrião pelo código', firstGuest.client.phase === 'connected' && secondGuest.client.phase === 'connected' && hostEvents.join(',') === 'joined:Convidado 1,joined:Convidado 2' && hostLink.guestCount === 2);
const heard: string[] = [];
hostServer.rpc.register('say', ({ senderId }, args) => heard.push(`${senderId}:${String(args[0])}`));
firstGuest.client.callServer('say', 0, ['oi']);
const crate = hostServer.objects.spawn({ kind: 'crate' });
play(300);
checks.check('RPCs e objetos atravessam o relay', heard.join(',') === '1:oi' && secondGuest.client.objects.get(crate.id)?.kind === 'crate');
const extraGuest = guest('Convidado 3', relayPath);
const lostGuest = guest('Perdido', 'relay/ZZZZZZ/client');
play(300);
checks.check('o relay respeita o máximo de conexões da reserva', extraGuest.events.join(',') === `disconnected:${DISCONNECT.rejected}:full`);
checks.check('código inexistente é recusado', lostGuest.events.join(',') === `disconnected:${DISCONNECT.rejected}:relay`);
checks.check('o servidor conta as salas de relay', backend.server.status().relayRooms === 1 && backend.server.status().relayConnections === 2);
secondGuest.client.leave();
play(300);
checks.check('a saída de um convidado chega ao anfitrião', hostEvents.at(-1) === `left:Convidado 2:${DISCONNECT.left}`);
hostLink.close();
play(300);
checks.check('quando o anfitrião encerra os convidados caem sem reconectar', firstGuest.events.at(-1) === `disconnected:${DISCONNECT.hostLeft}` && firstGuest.client.phase === 'closed' && backend.server.status().relayRooms === 0 && hostEnded.length === 1);
const visitor = guest('Visitante', 'session/ar ena!!');
play(300);
checks.check('sessão aberta nasce no primeiro acesso, com o nome limpo', visitor.client.phase === 'connected' && visitor.client.sessionId === 'arena' && backend.server.sessionOf('arena')?.players.length === 1);
checks.check('os objetos de rede da cena já existem na sessão', visitor.client.objects.get(7)?.kind === 'door' && visitor.client.objects.get(7)?.variables.get('open') === false);
const before = backend.server.status().sessions.length;
const crowd = ['b', 'c', 'd', 'e', 'f'].map((name) => guest(name, `session/${name}`));
play(300);
const refused = crowd.filter((entry) => entry.events.join(',') === `disconnected:${DISCONNECT.rejected}:full`).length;
checks.check('o servidor não passa do máximo de sessões', backend.server.status().sessions.length === 4 && refused === 5 - (4 - before), `${refused} recusados, ${before} sessões antes`);
for (const entry of guests)
    entry.client.leave();
play(6000);
checks.check('sessões vazias fecham sozinhas', backend.server.status().sessions.length === 0 && backend.server.status().players === 0);
backend.close();
checks.finish();
