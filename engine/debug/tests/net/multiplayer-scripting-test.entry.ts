import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import type { MultiplayerRuntime } from '@/engine/net/runtime/multiplayer-runtime';
import { createSessionBlueprint } from '@/engine/net/runtime/session-blueprint';
import type { SessionLink } from '@/engine/net/runtime/session-link';
import { createNetworkObjectSettings, createPlayerObjectSettings } from '@/engine/net/scene/network-object-settings';
import { PERFECT_CONDITIONS } from '@/engine/net/transport/network-conditions';
import { API_MANIFEST } from '@/engine/scripting/api-manifest';
import { createMultiplayerApi } from '@/engine/scripting/api/multiplayer/multiplayer';
import { EventBus } from '@/engine/scripting/runtime/event-bus';
import { createMultiplayerRuntime } from '@/engine/scripting/runtime/multiplayer-bridge';
import type { RuntimeHost } from '@/engine/scripting/runtime/runtime-host';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Multiplayer nos scripts');
const FRAME_MS = 8;
interface ScriptWorld {
    readonly scene: Scene;
    readonly door: Entity;
    readonly hero: Entity;
    readonly bullet: Entity;
    readonly runtime: MultiplayerRuntime;
    readonly api: ReturnType<typeof createMultiplayerApi>;
    readonly updaters: Set<(dt: number) => void>;
}
function hasMember(root: unknown, path: string): boolean {
    let current = root;
    for (const part of path.split('.')) {
        if (typeof current !== 'object' || current === null || !(part in current))
            return false;
        current = (current as Record<string, unknown>)[part];
    }
    return true;
}
function createWorld(name: string, enabled: boolean, link?: SessionLink): ScriptWorld {
    const scene = new Scene();
    Object.assign(scene.multiplayer, { enabled, rpcs: [{ name: 'wave', audience: 'others', requireOwnership: false, reliable: true, perSecond: 20 }] });
    const door = scene.createEntity({ name: 'Porta', kind: 'group', networkObject: { ...createNetworkObjectSettings(), variables: [{ name: 'open', initial: false, writer: 'server' }] } });
    const hero = scene.createEntity({ name: 'Heroi', kind: 'group', networkObject: createPlayerObjectSettings() });
    const bullet = scene.createEntity({ name: 'Projetil', kind: 'group', networkObject: { ...createNetworkObjectSettings(), spawn: 'template' } });
    const updaters = new Set<(dt: number) => void>();
    const parts = {
        session: { scene, selectedEntity: null, select: () => undefined },
        bus: new EventBus({ invoke: (_owner, _phase, run) => run() }),
        updaters,
        disposers: new Set<() => void>(),
        current: null,
        invoke: <TValue>(_owner: unknown, _phase: string, run: () => TValue) => run(),
        trackSpawned: () => undefined,
        destroyScriptsOf: () => undefined,
        requestActorSync: () => undefined,
        log: () => undefined,
    };
    const host = parts as unknown as RuntimeHost;
    const runtime = createMultiplayerRuntime(host);
    Object.assign(parts, { multiplayer: runtime });
    if (enabled)
        runtime.start({ blueprint: createSessionBlueprint(scene, { tickRate: 30, maxPlayers: 4 }), serverUrl: null, conditions: PERFECT_CONDITIONS, identity: { name, ticket: null }, link });
    return { scene, door, hero, bullet, runtime, api: createMultiplayerApi(host), updaters };
}
function shareLink(owner: ScriptWorld): SessionLink {
    const link = owner.runtime.link;
    if (!link)
        throw new Error('The host world has no session link to share.');
    return { kind: link.kind, now: () => link.now(), openSocket: (path) => link.openSocket(path), openServices: () => link.openServices(), advance: () => undefined, close: () => undefined };
}
function play(worlds: readonly ScriptWorld[], durationMs: number): void {
    for (let elapsed = 0; elapsed < durationMs; elapsed += FRAME_MS) {
        for (const world of worlds) {
            world.runtime.update(FRAME_MS);
            for (const updater of world.updaters)
                updater(FRAME_MS / 1000);
        }
    }
}
function nextTask(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
async function settle(worlds: readonly ScriptWorld[], durationMs: number): Promise<void> {
    for (let round = 0; round < 6; round++) {
        await nextTask();
        play(worlds, durationMs / 6);
    }
}
async function messageOf(action: Promise<unknown>): Promise<string> {
    try {
        await action;
        return '';
    }
    catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}
const ana = createWorld('Ana', true);
const bia = createWorld('Bia', true, shareLink(ana));
const pair = [ana, bia];
const manifest = API_MANIFEST.find((namespace) => namespace.name === 'multiplayer');
const missing = manifest?.members.filter((member) => !hasMember(ana.api, member)) ?? ['multiplayer'];
checks.check('a API entrega cada membro que o manifesto promete', (manifest?.members.length ?? 0) > 40 && missing.length === 0, missing.join(', '));
const connections: unknown[] = [];
const joined: string[] = [];
ana.api.onConnected((info: unknown) => connections.push(info));
ana.api.onPlayerJoined((player: { name: string }) => joined.push(player.name));
play(pair, 400);
checks.check('o script lê a sessão em que o jogo entrou', ana.api.enabled && ana.api.connected && ana.api.phase === 'connected' && ana.api.sessionId === 'principal' && ana.api.isHost && !bia.api.isHost && !ana.api.hosted);
checks.check('onConnected entrega a sessão e o jogador', connections.length === 1 && hasMember(connections[0], 'sessionId') && joined.join(',') === 'Bia');
checks.check('a lista de jogadores marca o local', ana.api.players().length === 2 && ana.api.localPlayer?.name === 'Ana' && ana.api.localPlayer.local && bia.api.players().filter((player) => player.local).length === 1);
const anaHero = ana.api.object(ana.hero);
const biaDoor = bia.api.object(bia.door);
checks.check('o ator em rede devolve o objeto com a posse', anaHero?.isMine === true && anaHero.actor === ana.hero && biaDoor?.isServerOwned === true && biaDoor.authority === 'server' && ana.api.object(ana.scene.root) === null);
const seen: string[] = [];
biaDoor?.watch('open', (value: unknown, previous: unknown) => seen.push(`${String(previous)}>${String(value)}`));
checks.check('só o anfitrião escreve a variável do servidor', biaDoor?.set('open', true) === false && ana.api.object(ana.door)?.set('open', true) === true);
play(pair, 300);
checks.check('a variável chega e avisa quem observa', biaDoor?.get('open') === true && seen.join(',') === 'false>true');
const heard: string[] = [];
ana.api.rpc.on('wave', (senderId: number, text: string) => heard.push(`global:${senderId}:${text}`));
ana.api.object(ana.door)?.on('wave', (senderId: number, text: string) => heard.push(`door:${senderId}:${text}`));
bia.api.rpc.send('wave', 'oi');
biaDoor?.send('wave', 'toc');
play(pair, 300);
const biaId = bia.api.localPlayer?.id ?? -1;
checks.check('RPC global e RPC de objeto chegam a quem escuta cada um', heard.join('|') === `global:${biaId}:oi|door:${biaId}:toc`, heard.join('|'));
checks.throws('argumento que não atravessa a rede é recusado', () => bia.api.rpc.send('wave', () => 1), 'não atravessa a rede');
const spawned: string[] = [];
bia.api.objects.onSpawned((object: { kind: string; actor: Entity; isCopy: boolean }) => spawned.push(`${object.kind}:${object.isCopy}:${Array.from(object.actor.transform.position).join(',')}`));
const bulletId = ana.api.spawn(ana.bullet, { position: [1, 2, 3] });
play(pair, 300);
checks.check('spawn cria a cópia do modelo nos outros jogadores', bulletId !== null && spawned.join('|') === `${ana.bullet.id}:true:1,2,3`, spawned.join('|'));
checks.check('convidado não cria objetos', bia.api.spawn(bia.bullet) === null);
checks.check('despawn remove a cópia', bulletId !== null && ana.api.despawn(bulletId) && (play(pair, 300), bia.api.objects.find(bulletId) === null));
const refusal = await messageOf(bia.api.lobby.join('nao-existe'));
checks.check('erro do serviço chega em português com o membro da API', refusal.startsWith('helix.multiplayer.lobby.join: não encontrado'), refusal);
const started: string[] = [];
bia.api.lobby.onStarted((ticket: { mode: string }) => started.push(ticket.mode));
const lobby = await ana.api.lobby.create({ name: 'Sala', maxMembers: 4 });
await bia.api.lobby.joinByCode(lobby.code);
await bia.api.lobby.setReady(true);
await settle(pair, 100);
checks.check('o lobby mostra os membros e a prontidão', ana.api.lobby.isHost && ana.api.lobby.current?.members.length === 2 && ana.api.lobby.current.members.some((member) => member.name === 'Bia' && member.isReady));
const ticket = await ana.api.lobby.start();
await settle(pair, 400);
checks.check('iniciar o lobby leva os scripts à mesma sessão', ticket.mode === 'dedicated' && started.join(',') === 'dedicated' && ana.api.sessionId === bia.api.sessionId && ana.api.sessionId !== 'principal' && bia.api.connected);
const reasons: string[] = [];
bia.api.onDisconnected((reason: string, description: string) => reasons.push(`${reason}:${description}`));
bia.api.leave();
play(pair, 200);
checks.check('sair avisa o script com o motivo descrito', reasons.join('|') === 'left:saiu da sessão' && bia.api.phase === 'offline');
ana.runtime.stop();
bia.runtime.stop();
const solo = createWorld('Solo', false);
checks.check('cena sem multiplayer responde sem falhar', !solo.api.enabled && solo.api.phase === 'offline' && !solo.api.join() && !solo.api.rpc.send('wave', 1) && solo.api.players().length === 0 && solo.api.object(solo.hero) === null);
const disabled = await messageOf(solo.api.lobby.create());
checks.check('serviços avisam que o multiplayer está desligado', disabled.includes('o multiplayer não está ligado nesta cena'), disabled);
checks.finish();
