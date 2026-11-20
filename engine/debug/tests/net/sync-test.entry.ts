import { MovementBudget } from '@/engine/net/sync/movement-budget';
import { PredictionBuffer } from '@/engine/net/sync/prediction-buffer';
import { SnapshotBuffer } from '@/engine/net/sync/snapshot-buffer';
import { createTransformState, type TransformState } from '@/engine/net/sync/transform-state';
import { NetClock } from '@/engine/net/time/net-clock';
import { DISCONNECT } from '@/engine/net/transport/disconnect-reason';
import type { NetworkConditions } from '@/engine/net/transport/network-conditions';
import { createCheckList } from '../support/check-list';
import { createSessionWorld, requireObject } from './session-test-support';
const checks = createCheckList('Sincronização: interpolação, autoridade, interesse e reconexão');
function at(x: number, y = 0, z = 0): TransformState {
    const transform = createTransformState();
    transform.position[0] = x;
    transform.position[1] = y;
    transform.position[2] = z;
    return transform;
}
const buffer = new SnapshotBuffer();
const sampled = createTransformState();
checks.check('sem amostras não há o que interpolar', !buffer.sample(0, sampled));
buffer.push(100, at(10), false);
buffer.push(0, at(0), false);
buffer.sample(50, sampled);
checks.near('interpola entre duas amostras, mesmo fora de ordem', sampled.position[0], 5);
buffer.sample(160, sampled);
checks.near('extrapola pouco além da última amostra', sampled.position[0], 16);
buffer.sample(900, sampled);
checks.near('a extrapolação tem teto', sampled.position[0], 22);
buffer.push(200, at(100), true);
buffer.sample(150, sampled);
checks.near('teletransporte não é interpolado', sampled.position[0], 10);
buffer.sample(200, sampled);
checks.near('teletransporte vale a partir do instante dele', sampled.position[0], 100);
const prediction = new PredictionBuffer<number, number>({ deltaSeconds: 0.5, step: (position, velocity, deltaSeconds) => position + velocity * deltaSeconds, diverged: (predicted, authoritative) => Math.abs(predicted - authoritative) > 0.01 });
let predicted = 0;
for (let tick = 1; tick <= 5; tick++)
    predicted = prediction.predict(tick, 2, predicted);
checks.near('a previsão aplica as entradas na hora', predicted, 5);
checks.check('servidor de acordo não corrige nada', prediction.reconcile(3, 3) === null && prediction.pendingCount === 2);
checks.near('servidor em desacordo refaz as entradas pendentes', prediction.reconcile(4, 10) ?? Number.NaN, 11);
checks.check('entradas recentes ficam para reenvio', prediction.recentInputs(3).map(({ tick }) => tick).join(',') === '5');
const budget = new MovementBudget(10);
let walked = true;
for (let step = 1; step <= 20; step++)
    walked &&= budget.allows([step - 1, 0, 0], [step, 0, 0], step * 100);
checks.check('andar na velocidade permitida passa', walked);
checks.check('salto impossível é recusado', !budget.allows([20, 0, 0], [520, 0, 0], 2100));
checks.check('velocidade ilimitada aceita qualquer salto', new MovementBudget(0).allows([0, 0, 0], [9999, 0, 0], 0));
const netClock = new NetClock();
netClock.addSample(1000, 5040, 5042, 1082);
checks.near('o relógio desconta o tempo que o servidor levou', netClock.roundTripMs, 80);
checks.near('o relógio estima a diferença para o servidor', netClock.serverTime(2000), 6000);
const HOME: NetworkConditions = { latencyMs: 30, jitterMs: 5, lossRate: 0.02, duplicateRate: 0.01, reorderRate: 0.02 };
const world = createSessionWorld(31, HOME);
const ana = world.join('Ana');
const bia = world.join('Bia');
world.run(600);
const SPEED = 10;
const mover = world.server.objects.spawn({ kind: 'mover' });
world.onTick = (tick, deltaSeconds) => {
    mover.transform.position[0] = SPEED * tick * deltaSeconds;
};
world.run(800);
let worstError = 0;
let wentBackwards = false;
let previousX = Number.NEGATIVE_INFINITY;
const view = createTransformState();
for (let frame = 0; frame < 200; frame++) {
    world.run(8);
    if (!bia.client.sampleTransform(mover.id, view))
        continue;
    worstError = Math.max(worstError, Math.abs(view.position[0] - (SPEED * bia.client.renderTimeMs) / 1000));
    wentBackwards ||= view.position[0] < previousX - 1e-6;
    previousX = view.position[0];
}
checks.check('objeto do servidor é interpolado no tempo certo apesar da perda', worstError < 0.2 && previousX > 0, `erro máximo de ${worstError}`);
checks.check('a interpolação nunca volta no tempo', !wentBackwards);
world.onTick = () => undefined;
const rewound = createTransformState();
const pastMs = world.server.timeMs - 400;
checks.check('o servidor reconstrói onde o objeto estava', world.server.history.sample(mover.id, pastMs, rewound) && Math.abs(rewound.position[0] - (SPEED * pastMs) / 1000) < 0.4, `x=${rewound.position[0]}`);
const car = world.server.objects.spawn({ kind: 'car', ownerId: 1, authority: 'owner', maxSpeed: 10 });
world.run(300);
const carOnAna = requireObject(ana.client.objects.get(car.id));
checks.check('quem simula é o dono, não o servidor', carOnAna.isSimulatedBy(1) && !car.isSimulatedBy(0) && !bia.client.publishTransform(car.id, at(1)));
const driveStartedAt = world.hub.timeMs;
for (let frame = 0; frame < 150; frame++) {
    ana.client.publishTransform(car.id, at((5 * (world.hub.timeMs - driveStartedAt)) / 1000));
    world.run(8);
}
const driven = (5 * (world.hub.timeMs - driveStartedAt)) / 1000;
checks.check('o estado do dono chega ao servidor', car.transform.position[0] > driven - 1 && car.transform.position[0] <= driven + 1e-3, `servidor em ${car.transform.position[0]}, dono em ${driven}`);
checks.check('os outros clientes veem o objeto do dono andar', bia.client.sampleTransform(car.id, view) && view.position[0] > driven - 1.6 && view.position[0] < driven, `visto em ${view.position[0]}`);
ana.client.publishTransform(car.id, at(driven + 500));
world.run(400);
checks.check('salto acima da velocidade máxima é recusado pelo servidor', car.transform.position[0] < driven + 1);
checks.check('o dono é corrigido para a posição do servidor', ana.corrected.includes(carOnAna) && Math.abs(carOnAna.transform.position[0] - car.transform.position[0]) < 1e-3);
const statue = world.server.objects.spawn({ kind: 'statue' });
world.run(400);
world.server.teleport(statue.id, at(100));
let crossedGap = false;
for (let frame = 0; frame < 60; frame++) {
    world.run(8);
    if (bia.client.sampleTransform(statue.id, view))
        crossedGap ||= view.position[0] > 5 && view.position[0] < 95;
}
checks.check('teletransporte do servidor chega sem deslizar pelo caminho', !crossedGap && view.position[0] === 100);
const avatarOfAna = world.server.objects.spawn({ kind: 'avatar', ownerId: 1, observer: true });
const avatarOfBia = world.server.objects.spawn({ kind: 'avatar', ownerId: 2, observer: true, transform: at(1000) });
const landmark = world.server.objects.spawn({ kind: 'landmark', relevance: { mode: 'distance', radius: 50 } });
const secret = world.server.objects.spawn({ kind: 'inventory', ownerId: 1, relevance: { mode: 'owner' } });
world.run(500);
checks.check('objeto distante não é enviado a quem está longe', ana.client.objects.get(landmark.id) !== undefined && bia.client.objects.get(landmark.id) === undefined);
checks.check('objeto só do dono não é enviado aos outros', ana.client.objects.get(secret.id) !== undefined && bia.client.objects.get(secret.id) === undefined);
avatarOfBia.transform.position[0] = 10;
world.run(500);
checks.check('ao se aproximar o objeto aparece', bia.client.objects.get(landmark.id) !== undefined);
avatarOfBia.transform.position[0] = 1000;
world.run(500);
checks.check('ao se afastar o objeto some', bia.client.objects.get(landmark.id) === undefined && avatarOfAna.ownerId === 1);
const turret = world.server.objects.spawn({ kind: 'turret', ownerId: 1 });
world.run(300);
for (let tick = 1; tick <= 6; tick++) {
    const recent = [tick - 2, tick - 1, tick].filter((entry) => entry >= 1).map((entry) => ({ tick: entry, input: { fire: entry % 2 === 0 } }));
    ana.client.sendInputs(turret.id, recent);
    world.run(16);
}
for (let repeat = 0; repeat < 4; repeat++) {
    ana.client.sendInputs(turret.id, [4, 5, 6].map((tick) => ({ tick, input: { fire: tick % 2 === 0 } })));
    world.run(16);
}
world.run(300);
const turretInputs = world.inputs.filter((entry) => entry.objectId === turret.id);
checks.check('entradas redundantes chegam uma vez cada e em ordem', turretInputs.map((entry) => entry.tick).join(',') === '1,2,3,4,5,6' && turretInputs.every((entry) => entry.playerId === 1));
world.server.acknowledgeInput(turret.id, 6);
world.run(300);
checks.check('o dono fica sabendo até onde o servidor processou', ana.client.inputTickOf(turret.id) === 6 && bia.client.inputTickOf(turret.id) === null);
world.grantOwnership = false;
bia.client.requestOwnership(turret.id);
world.run(300);
checks.check('pedido de posse negado não muda o dono', turret.ownerId === 1);
world.grantOwnership = true;
bia.client.requestOwnership(turret.id);
world.run(300);
checks.check('pedido de posse aceito troca o dono em todos', turret.ownerId === 2 && ana.client.objects.get(turret.id)?.ownerId === 2);
world.events.length = 0;
ana.sockets.at(-1)?.close(DISCONNECT.timeout);
world.run(100);
checks.check('queda de conexão põe o cliente em reconexão', ana.client.phase === 'reconnecting' && ana.events.at(-1) === 'reconnecting:1');
world.run(1500);
checks.check('o cliente volta com a mesma identidade', ana.client.phase === 'connected' && ana.client.localId === 1 && ana.events.at(-1) === 'resumed');
checks.check('o servidor suspende e retoma sem anunciar saída', world.events.join(',') === 'suspended:1,resumed:1');
checks.check('os objetos do jogador sobrevivem à queda', world.server.objects.get(car.id) !== undefined && ana.client.objects.get(car.id)?.ownerId === 1);
const keepsake = world.server.objects.spawn({ kind: 'flag', ownerId: 2, ownerLeftPolicy: 'server' });
world.run(200);
world.events.length = 0;
bia.frozen = true;
bia.sockets.at(-1)?.close(DISCONNECT.timeout);
world.run(1000);
checks.check('durante a carência o jogador ainda conta', world.server.players.length === 2 && !world.server.isConnected(2));
world.run(3000);
checks.check('sem voltar na carência o jogador sai', world.events.join(',') === `suspended:2,left:2:${DISCONNECT.timeout}` && ana.events.includes(`left:2:${DISCONNECT.timeout}`));
checks.check('os objetos de quem saiu seguem a política de cada um', world.server.objects.get(turret.id) === undefined && keepsake.ownerId === 0 && world.server.objects.get(avatarOfBia.id) === undefined);
checks.finish();
