import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { MultiplayerRuntime } from '@/engine/net/runtime/multiplayer-runtime';
import { createSessionBlueprint } from '@/engine/net/runtime/session-blueprint';
import { createPlayerObjectSettings } from '@/engine/net/scene/network-object-settings';
import type { SessionTopology } from '@/engine/net/settings/multiplayer-settings';
import { MAX_TEST_CLIENTS } from '@/engine/net/tools/test-clients';
import { NETWORK_PRESETS, PERFECT_CONDITIONS } from '@/engine/net/transport/network-conditions';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Ferramentas: clientes de teste e rede simulada');
const FRAME_MS = 8;
interface World {
    readonly hero: Entity;
    readonly runtime: MultiplayerRuntime;
    readonly copies: Entity[];
}
function createWorld(topology: SessionTopology): World {
    const scene = new Scene();
    Object.assign(scene.multiplayer, { enabled: true, topology });
    const hero = scene.createEntity({ name: 'Heroi', kind: 'group', networkObject: createPlayerObjectSettings() });
    const copies: Entity[] = [];
    const runtime = new MultiplayerRuntime({
        scene,
        entitySpawned: (entity) => copies.push(entity),
        entityRemoved: (entity) => {
            copies.splice(copies.indexOf(entity), 1);
            entity.parent?.remove(entity);
        },
        log: () => undefined,
    }, {
        phaseChanged: () => undefined,
        playerJoined: () => undefined,
        playerLeft: () => undefined,
        objectBound: () => undefined,
        objectUnbound: () => undefined,
        objectCorrected: () => undefined,
        ownerChanged: () => undefined,
    });
    runtime.start({ blueprint: createSessionBlueprint(scene, { tickRate: 30, maxPlayers: 16 }), serverUrl: null, conditions: PERFECT_CONDITIONS, identity: { name: 'Ana', ticket: null } });
    return { hero, runtime, copies };
}
function play(world: World, durationMs: number): void {
    for (let elapsed = 0; elapsed < durationMs; elapsed += FRAME_MS)
        world.runtime.update(FRAME_MS);
}
async function settle(world: World, durationMs: number): Promise<void> {
    for (let round = 0; round < 6; round++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        play(world, durationMs / 6);
    }
}
const world = createWorld('dedicated');
checks.check('sem sessão não há onde pôr o cliente de teste', !world.runtime.addTestClient());
play(world, 300);
checks.check('dois clientes de teste entram na sessão do jogo', world.runtime.addTestClient() && world.runtime.addTestClient() && world.runtime.testClientCount === 2);
play(world, 400);
checks.check('eles contam como jogadores e ganham personagem', world.runtime.players.length === 3 && world.copies.length === 2 && world.runtime.players.some((player) => player.name === 'Teste 1'));
const before = Array.from(world.copies[0].transform.position);
play(world, 900);
const after = Array.from(world.copies[0].transform.position);
checks.check('o personagem do cliente de teste se move sozinho', Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.5, `${before.join(',')} -> ${after.join(',')}`);
const lossy = NETWORK_PRESETS.find((preset) => preset.id === 'unstable');
checks.check('a rede simulada troca de condição durante o jogo', lossy !== undefined && world.runtime.setConditions(lossy.conditions));
play(world, 2000);
checks.check('a sessão sobrevive à conexão instável', world.runtime.phase === 'connected' && world.runtime.players.length === 3 && (world.runtime.stats?.roundTripMs ?? 0) > 50, `${world.runtime.phase} · ${world.runtime.stats?.roundTripMs ?? 0} ms`);
world.runtime.setConditions(PERFECT_CONDITIONS);
checks.check('remover tira o último cliente de teste', world.runtime.removeTestClient() && world.runtime.testClientCount === 1);
play(world, 400);
checks.check('a saída dele apaga o personagem', world.runtime.players.length === 2 && world.copies.length === 1);
let added = 0;
while (world.runtime.addTestClient())
    added++;
checks.check('o número de clientes de teste tem limite', world.runtime.testClientCount === MAX_TEST_CLIENTS && added === MAX_TEST_CLIENTS - 1);
world.runtime.leave();
play(world, 300);
checks.check('sair da sessão leva os clientes de teste junto', world.runtime.testClientCount === 0);
world.runtime.stop();
const hosted = createWorld('relay');
await settle(hosted, 300);
checks.check('cliente de teste entra pelo relay na sessão do anfitrião', hosted.runtime.isHost && hosted.runtime.addTestClient());
play(hosted, 500);
checks.check('o anfitrião vê o cliente de teste como convidado', hosted.runtime.players.length === 2 && hosted.copies.length === 1);
hosted.runtime.stop();
checks.check('parar encerra os clientes de teste', hosted.runtime.testClientCount === 0 && hosted.copies.length === 0);
checks.finish();
