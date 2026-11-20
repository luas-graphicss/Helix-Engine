import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { MultiplayerRuntime } from '@/engine/net/runtime/multiplayer-runtime';
import type { ObjectCommands } from '@/engine/net/runtime/object-commands';
import type { RpcRouter } from '@/engine/net/runtime/rpc-router';
import type { SceneBinding } from '@/engine/net/runtime/scene-binding';
import { createSessionBlueprint } from '@/engine/net/runtime/session-blueprint';
import type { SessionLink } from '@/engine/net/runtime/session-link';
import { createNetworkObjectSettings, createPlayerObjectSettings } from '@/engine/net/scene/network-object-settings';
import type { LobbyClient } from '@/engine/net/services/lobby/lobby-client';
import type { MatchmakingClient } from '@/engine/net/services/matchmaking/matchmaking-client';
import type { SessionTopology } from '@/engine/net/settings/multiplayer-settings';
import { createTransformState } from '@/engine/net/sync/transform-state';
import { DISCONNECT } from '@/engine/net/transport/disconnect-reason';
import { PERFECT_CONDITIONS } from '@/engine/net/transport/network-conditions';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Runtime de multiplayer: sessão, atores, RPCs e serviços');
const FRAME_MS = 8;
const POSE_TOLERANCE = 0.02;
interface World {
    readonly name: string;
    readonly scene: Scene;
    readonly door: Entity;
    readonly hero: Entity;
    readonly crate: Entity;
    readonly bullet: Entity;
    readonly runtime: MultiplayerRuntime;
    readonly events: string[];
    readonly removed: Entity[];
}
function createWorld(name: string, topology: SessionTopology, autoJoin: boolean): World {
    const scene = new Scene();
    Object.assign(scene.multiplayer, {
        enabled: true,
        topology,
        autoJoin,
        rpcs: [
            { name: 'wave', audience: 'others', requireOwnership: false, reliable: true, perSecond: 20 },
            { name: 'score', audience: 'server', requireOwnership: false, reliable: true, perSecond: 20 },
        ],
    });
    const door = scene.createEntity({ name: 'Porta', kind: 'group', networkObject: { ...createNetworkObjectSettings(), variables: [{ name: 'open', initial: false, writer: 'server' }] } });
    const hero = scene.createEntity({ name: 'Heroi', kind: 'group', networkObject: createPlayerObjectSettings() });
    const crate = scene.createEntity({ name: 'Caixa', kind: 'group', networkObject: { ...createNetworkObjectSettings(), authority: 'owner', transferable: true, ownerLeftPolicy: 'server' } });
    const bullet = scene.createEntity({ name: 'Projetil', kind: 'group', networkObject: { ...createNetworkObjectSettings(), spawn: 'template' } });
    const events: string[] = [];
    const removed: Entity[] = [];
    const runtime = new MultiplayerRuntime({
        scene,
        entitySpawned: () => undefined,
        entityRemoved: (entity) => {
            removed.push(entity);
            entity.parent?.remove(entity);
        },
        log: (level, message) => events.push(`${level}:${message}`),
    }, {
        phaseChanged: (phase, reason) => events.push(`phase:${phase}:${reason}`),
        playerJoined: (player) => events.push(`joined:${player.name}`),
        playerLeft: (player) => events.push(`left:${player.name}`),
        objectBound: (binding) => events.push(`bound:${binding.objectId}`),
        objectUnbound: (binding) => events.push(`unbound:${binding.objectId}`),
        objectCorrected: (binding) => events.push(`corrected:${binding.objectId}`),
        ownerChanged: (binding, previous) => events.push(`owner:${binding.objectId}:${previous}>${binding.object.ownerId}`),
    });
    return { name, scene, door, hero, crate, bullet, runtime, events, removed };
}
function start(world: World, link?: SessionLink): void {
    world.runtime.start({
        blueprint: createSessionBlueprint(world.scene, { tickRate: 30, maxPlayers: 4 }),
        serverUrl: null,
        conditions: PERFECT_CONDITIONS,
        identity: { name: world.name, ticket: null },
        link,
    });
}
function shareLink(owner: World): SessionLink {
    const link = owner.runtime.link;
    if (!link)
        throw new Error(`${owner.name} has no session link to share.`);
    return { kind: link.kind, now: () => link.now(), openSocket: (path) => link.openSocket(path), openServices: () => link.openServices(), advance: () => undefined, close: () => undefined };
}
function play(worlds: readonly World[], durationMs: number): void {
    for (let elapsed = 0; elapsed < durationMs; elapsed += FRAME_MS)
        for (const world of worlds)
            world.runtime.update(FRAME_MS);
}
function nextTask(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
async function settle(worlds: readonly World[], durationMs: number): Promise<void> {
    for (let round = 0; round < 6; round++) {
        await nextTask();
        play(worlds, durationMs / 6);
    }
}
function required<TValue>(value: TValue | null | undefined, what: string): TValue {
    if (value === null || value === undefined)
        throw new Error(`${what} was expected to exist.`);
    return value;
}
const bindingOf = (world: World): SceneBinding => required(world.runtime.binding, `${world.name} binding`);
const objectsOf = (world: World): ObjectCommands => required(world.runtime.objects, `${world.name} object commands`);
const rpcOf = (world: World): RpcRouter => required(world.runtime.rpc, `${world.name} rpc router`);
const lobbyOf = (world: World): LobbyClient => required(world.runtime.lobby, `${world.name} lobby`);
const matchmakingOf = (world: World): MatchmakingClient => required(world.runtime.matchmaking, `${world.name} matchmaking`);
const ana = createWorld('Ana', 'dedicated', true);
const bia = createWorld('Bia', 'dedicated', true);
start(ana);
start(bia, shareLink(ana));
const pair = [ana, bia];
play(pair, 400);
checks.check('os dois entram na sessão padrão', ana.runtime.phase === 'connected' && bia.runtime.phase === 'connected' && ana.runtime.sessionId === 'principal' && ana.runtime.players.length === 2 && bia.runtime.players.length === 2);
checks.check('só quem roda o servidor é anfitrião', ana.runtime.isHost && !bia.runtime.isHost);
checks.check('o modelo sob demanda fica oculto no jogo', !ana.bullet.visible && !bia.bullet.visible);
const anaHero = required(bindingOf(ana).ofEntity(ana.hero), 'Ana hero binding');
const biaHero = required(bindingOf(bia).ofEntity(bia.hero), 'Bia hero binding');
checks.check('cada jogador é dono do próprio personagem', anaHero.object.ownerId === ana.runtime.localPlayerId && biaHero.object.ownerId === bia.runtime.localPlayerId && anaHero.objectId !== biaHero.objectId && !anaHero.isCopy);
const biaSeenByAna = required(bindingOf(ana).ofObject(biaHero.objectId), 'copy of Bia in Ana world');
const anaSeenByBia = required(bindingOf(bia).ofObject(anaHero.objectId), 'copy of Ana in Bia world');
checks.check('o personagem do outro jogador aparece como cópia sem componente de rede', biaSeenByAna.isCopy && biaSeenByAna.entity !== ana.hero && biaSeenByAna.entity.networkObject === null && biaSeenByAna.entity.parent === ana.hero.parent);
ana.hero.transform.position.set([5, 0, 2]);
ana.hero.transform.rotation.set([0, 30, 0]);
bia.hero.transform.position.set([-3, 1, 0]);
play(pair, 700);
checks.nearAll('o movimento do dono chega à cópia do outro jogador', anaSeenByBia.entity.transform.position, [5, 0, 2], POSE_TOLERANCE);
checks.nearAll('a rotação do dono chega à cópia', anaSeenByBia.entity.transform.rotation, [0, 30, 0], 0.5);
checks.nearAll('o movimento do convidado chega ao anfitrião', biaSeenByAna.entity.transform.position, [-3, 1, 0], POSE_TOLERANCE);
ana.door.transform.position.set([0, 3, 0]);
bia.door.transform.position.set([7, 7, 7]);
play(pair, 700);
checks.nearAll('o objeto do servidor segue o anfitrião e ignora o convidado', bia.door.transform.position, [0, 3, 0], POSE_TOLERANCE);
checks.check('o anfitrião escreve a variável do servidor', objectsOf(ana).setVariable(ana.door.id, 'open', true));
play(pair, 300);
checks.check('a variável chega ao convidado', bindingOf(bia).ofObject(bia.door.id)?.object.variables.get('open') === true);
checks.check('o convidado não escreve variável do servidor', !objectsOf(bia).setVariable(bia.door.id, 'open', false));
const heard: string[] = [];
rpcOf(ana).onClient('wave', (senderId, _objectId, args) => heard.push(`ana:${senderId}:${String(args[0])}`));
rpcOf(bia).onClient('wave', (senderId, _objectId, args) => heard.push(`bia:${senderId}:${String(args[0])}`));
rpcOf(bia).callServer('wave', 0, ['oi'], true);
play(pair, 300);
checks.check('RPC declarado é repassado só aos outros jogadores', heard.join('|') === `ana:${bia.runtime.localPlayerId}:oi`, heard.join('|'));
const scored: string[] = [];
rpcOf(ana).onServer('score', (senderId, _objectId, args) => scored.push(`${senderId}:${String(args[0])}`));
rpcOf(bia).callServer('score', 0, [10], true);
rpcOf(bia).onClient('announce', (senderId, _objectId, args) => heard.push(`announce:${senderId}:${String(args[0])}`));
play(pair, 300);
checks.check('RPC de servidor chega ao script do anfitrião', scored.join('|') === `${bia.runtime.localPlayerId}:10`, scored.join('|'));
checks.check('só o anfitrião chama os clientes', rpcOf(ana).callClients('announce', 0, ['fim'], {}) && !rpcOf(bia).callClients('announce', 0, ['x'], {}));
play(pair, 300);
checks.check('a chamada do anfitrião chega com o servidor como remetente', heard.at(-1) === 'announce:0:fim', heard.join('|'));
const launch = createTransformState();
launch.position[0] = 1;
launch.position[1] = 1;
const bulletId = required(objectsOf(ana).spawn(ana.bullet, { transform: launch }), 'spawned bullet id');
play(pair, 300);
const anaBullet = required(bindingOf(ana).ofObject(bulletId), 'bullet in Ana world');
const biaBullet = required(bindingOf(bia).ofObject(bulletId), 'bullet in Bia world');
checks.check('o anfitrião cria cópias visíveis do modelo para todos', anaBullet.isCopy && biaBullet.isCopy && biaBullet.entity.visible && biaBullet.entity !== bia.bullet);
checks.nearAll('a cópia nasce na pose pedida', biaBullet.entity.transform.position, [1, 1, 0], POSE_TOLERANCE);
anaBullet.entity.transform.position.set([1, 1, 9]);
play(pair, 700);
checks.nearAll('a cópia do anfitrião conduz a dos convidados', biaBullet.entity.transform.position, [1, 1, 9], POSE_TOLERANCE);
checks.check('convidado não cria nem remove objetos', objectsOf(bia).spawn(bia.bullet) === null && !objectsOf(bia).despawn(bulletId));
checks.check('o anfitrião remove o objeto', objectsOf(ana).despawn(bulletId));
play(pair, 300);
checks.check('remover apaga as cópias dos dois lados', bindingOf(ana).ofObject(bulletId) === undefined && bindingOf(bia).ofObject(bulletId) === undefined && bia.removed.includes(biaBullet.entity) && ana.removed.includes(anaBullet.entity));
objectsOf(bia).requestOwnership(bia.crate.id);
objectsOf(bia).requestOwnership(bia.door.id);
play(pair, 300);
checks.check('só o objeto transferível troca de dono', bindingOf(ana).ofObject(ana.crate.id)?.object.ownerId === bia.runtime.localPlayerId && bindingOf(ana).ofObject(ana.door.id)?.object.ownerId === 0);
checks.check('a troca de dono é avisada', bia.events.includes(`owner:${bia.crate.id}:0>${bia.runtime.localPlayerId}`));
bia.crate.transform.position.set([4, 0, 4]);
play(pair, 700);
checks.nearAll('o novo dono passa a mover o objeto', ana.crate.transform.position, [4, 0, 4], POSE_TOLERANCE);
const teleported = createTransformState();
teleported.position[2] = -6;
checks.check('o anfitrião teleporta o objeto de um jogador', objectsOf(ana).teleport(biaHero.objectId, teleported));
play(pair, 400);
checks.nearAll('o teleporte corrige o dono', bia.hero.transform.position, [0, 0, -6], POSE_TOLERANCE);
checks.check('a correção é avisada ao dono', bia.events.includes(`corrected:${biaHero.objectId}`));
checks.check('o anfitrião remove um objeto da cena', objectsOf(ana).despawn(ana.door.id));
play(pair, 300);
checks.check('objeto da cena removido fica oculto para todos', !ana.door.visible && !bia.door.visible);
bia.runtime.leave();
play(pair, 300);
checks.check('quando o convidado sai a cópia dele some', ana.runtime.players.length === 1 && bindingOf(ana).ofObject(biaHero.objectId) === undefined && ana.removed.includes(biaSeenByAna.entity) && bia.runtime.phase === 'offline');
checks.check('o objeto do jogador que saiu volta ao servidor', bindingOf(ana).ofObject(ana.crate.id)?.object.ownerId === 0);
checks.check('sair não gera aviso de queda', bia.events.at(-1) === `phase:offline:${DISCONNECT.left}`);
ana.runtime.stop();
bia.runtime.stop();
checks.check('parar devolve os atores ocultos', ana.bullet.visible && ana.door.visible && bia.door.visible && ana.runtime.phase === 'offline' && !ana.runtime.isActive);
const host = createWorld('Lia', 'relay', true);
const guest = createWorld('Noa', 'relay', false);
start(host);
start(guest, shareLink(host));
const relayPair = [host, guest];
await settle(relayPair, 300);
const joinCode = host.runtime.joinCode;
checks.check('o anfitrião abre a sessão por relay e recebe o código', joinCode.length === 6 && host.runtime.isHost && host.runtime.phase === 'connected', host.events.join(' | '));
checks.check('o convidado entra pelo código em minúsculas', guest.runtime.joinByCode(` ${joinCode.toLowerCase()} `));
play(relayPair, 400);
checks.check('os dois ficam na sessão do anfitrião', guest.runtime.phase === 'connected' && host.runtime.players.length === 2 && !guest.runtime.isHost && guest.runtime.sessionId === joinCode);
host.door.transform.position.set([2, 2, 2]);
guest.hero.transform.position.set([0, 0, 8]);
play(relayPair, 700);
checks.nearAll('o objeto do anfitrião chega ao convidado pelo relay', guest.door.transform.position, [2, 2, 2], POSE_TOLERANCE);
const guestHero = required(bindingOf(guest).ofEntity(guest.hero), 'guest hero binding');
checks.nearAll('o convidado move o próprio personagem pelo relay', required(bindingOf(host).ofObject(guestHero.objectId), 'guest copy on host').entity.transform.position, [0, 0, 8], POSE_TOLERANCE);
host.runtime.leave();
play(relayPair, 400);
checks.check('quando o anfitrião sai o convidado cai sem reconectar', guest.runtime.phase === 'offline' && guest.events.at(-1) === `phase:offline:${DISCONNECT.hostLeft}`, guest.events.at(-1));
host.runtime.stop();
guest.runtime.stop();
const first = createWorld('Rui', 'dedicated', false);
const second = createWorld('Sol', 'dedicated', false);
start(first);
start(second, shareLink(first));
const party = [first, second];
const lobby = await lobbyOf(first).create({ name: 'Sala do Rui' });
await lobbyOf(second).joinByCode(lobby.code);
const ticket = await first.runtime.startLobby();
const lobbySessionId = ticket.mode === 'dedicated' ? ticket.sessionId : '';
await settle(party, 400);
checks.check('iniciar o lobby leva todos à sessão reservada', lobbySessionId !== '' && first.runtime.phase === 'connected' && second.runtime.phase === 'connected' && first.runtime.sessionId === lobbySessionId && second.runtime.sessionId === lobbySessionId);
await lobbyOf(first).leave();
await lobbyOf(second).leave();
const searches = [matchmakingOf(first).find('casual'), matchmakingOf(second).find('casual')];
await settle(party, 900);
const [match] = await Promise.all(searches);
await settle(party, 400);
const matchSessionId = match.session.mode === 'dedicated' ? match.session.sessionId : '';
checks.check('a partida encontrada leva os dois à mesma sessão nova', matchSessionId !== '' && first.runtime.sessionId === matchSessionId && second.runtime.sessionId === matchSessionId && matchSessionId !== lobbySessionId && first.runtime.players.length === 2);
first.runtime.stop();
second.runtime.stop();
checks.finish();
