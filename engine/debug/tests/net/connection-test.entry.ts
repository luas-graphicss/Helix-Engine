import { Connection, DEFAULT_CONNECTION_OPTIONS } from '@/engine/net/connection/connection';
import { DISCONNECT } from '@/engine/net/transport/disconnect-reason';
import { LoopbackHub } from '@/engine/net/transport/loopback-hub';
import { PERFECT_CONDITIONS, type NetworkConditions } from '@/engine/net/transport/network-conditions';
import { createCheckList } from '../support/check-list';
import { linkConnections, numberedPayload, payloadNumber, seededRandom } from './net-test-support';
const checks = createCheckList('Conexão confiável sobre rede com perda');
const HOSTILE: NetworkConditions = { latencyMs: 40, jitterMs: 25, lossRate: 0.3, duplicateRate: 0.1, reorderRate: 0.3 };
const MESSAGE_COUNT = 600;
const hostile = linkConnections(HOSTILE, 11);
hostile.run(400);
checks.check('os dois lados abrem mesmo com perda', hostile.clientProbe.opened && hostile.serverProbe.opened);
for (let index = 0; index < MESSAGE_COUNT; index++) {
    hostile.client.send(numberedPayload(index), 'reliable');
    hostile.run(10);
}
hostile.run(30000);
const ordered = hostile.serverProbe.received.map(({ payload }) => payloadNumber(payload));
checks.check('mensagens confiáveis chegam todas, uma vez e em ordem', ordered.length === MESSAGE_COUNT && ordered.every((value, index) => value === index), `chegaram ${ordered.length}`);
checks.check('a perda forçou reenvios', hostile.client.stats.resentFrames > 0);
checks.check('a perda medida fica perto da simulada', hostile.client.stats.lossRate > 0.15 && hostile.client.stats.lossRate < 0.6, `medida ${hostile.client.stats.lossRate}`);
checks.check('nada fica na fila depois da confirmação', hostile.client.stats.backlogBytes === 0);
const bulky = new Uint8Array(200 * 1024);
for (let index = 0; index < bulky.length; index++)
    bulky[index] = (index * 31 + 7) & 0xff;
hostile.serverProbe.received.length = 0;
hostile.client.send(bulky, 'reliable');
hostile.client.send(numberedPayload(77), 'reliable');
hostile.run(60000);
const [rebuilt, after] = hostile.serverProbe.received;
checks.check('mensagem maior que um pacote é fragmentada e remontada', rebuilt?.payload.length === bulky.length && rebuilt.payload.every((byte, index) => byte === bulky[index]));
checks.check('a mensagem seguinte espera a fragmentada', after !== undefined && payloadNumber(after.payload) === 77 && hostile.serverProbe.received.length === 2);
hostile.clientProbe.received.length = 0;
for (let index = 0; index < 400; index++) {
    hostile.server().send(numberedPayload(index), 'unreliable');
    hostile.run(20);
}
hostile.run(1000);
const loose = hostile.clientProbe.received.filter(({ delivery }) => delivery === 'unreliable').map(({ payload }) => payloadNumber(payload));
checks.check('mensagens não confiáveis podem se perder', loose.length > 150 && loose.length < 400, `chegaram ${loose.length}`);
checks.check('mensagens não confiáveis nunca chegam duplicadas', new Set(loose).size === loose.length);
const steady = linkConnections({ ...PERFECT_CONDITIONS, latencyMs: 50 }, 3);
steady.run(200);
for (let index = 0; index < 100; index++) {
    steady.client.send(numberedPayload(index), 'unreliable');
    steady.run(20);
}
checks.near('o tempo de ida e volta é o dobro da latência', steady.client.stats.roundTripMs, 100, 12);
checks.check('sem perda não há reenvio', steady.client.stats.resentFrames === 0 && steady.client.stats.lossRate === 0);
checks.check('o tráfego por segundo é medido', steady.client.stats.bytesSentPerSecond > 0 && steady.server().stats.bytesReceivedPerSecond > 0);
checks.throws('mensagem não confiável maior que um pacote é recusada', () => steady.client.send(new Uint8Array(4000), 'unreliable'), 'exceeds');
checks.throws('mensagem confiável acima do limite é recusada', () => steady.client.send(new Uint8Array(DEFAULT_CONNECTION_OPTIONS.maxMessageBytes + 1), 'reliable'), 'exceeds');
const silent = linkConnections(PERFECT_CONDITIONS, 5, { ...DEFAULT_CONNECTION_OPTIONS, timeoutMs: 1500 });
silent.run(100);
silent.runClientOnly(2500);
checks.check('conexão sem resposta expira', silent.clientProbe.closedWith === DISCONNECT.timeout && silent.client.state === 'closed');
const choked = linkConnections(PERFECT_CONDITIONS, 6, { ...DEFAULT_CONNECTION_OPTIONS, maxBacklogBytes: 64 * 1024 });
choked.run(100);
for (let index = 0; index < 80; index++)
    choked.client.send(new Uint8Array(1024), 'reliable');
choked.runClientOnly(200);
checks.check('fila de envio sem confirmação derruba a conexão', choked.clientProbe.closedWith === DISCONNECT.overflow);
const closing = linkConnections(PERFECT_CONDITIONS, 8);
closing.run(100);
closing.server().close('kicked:teste');
closing.run(100);
checks.check('fechar de um lado avisa o outro com o motivo', closing.clientProbe.closedWith === 'kicked:teste' && closing.serverProbe.closedWith === null);
const hub = new LoopbackHub(seededRandom(9));
const unreachable: string[] = [];
const lonely = new Connection(hub.connect('nowhere'), () => hub.timeMs, { opened: () => unreachable.push('opened'), message: () => unreachable.push('message'), closed: (reason) => unreachable.push(reason) });
hub.advance(50);
lonely.update();
checks.check('endereço sem servidor fecha como inalcançável', unreachable.join(',') === DISCONNECT.unreachable);
const rawHub = new LoopbackHub(seededRandom(12));
const garbageLog: string[] = [];
let victim: Connection | null = null;
rawHub.listen('game', (socket) => {
    victim = new Connection(socket, () => rawHub.timeMs, { opened: () => garbageLog.push('opened'), message: () => garbageLog.push('message'), closed: (reason) => garbageLog.push(reason) });
});
const attacker = rawHub.connect('game');
attacker.attach({ opened: () => undefined, received: () => undefined, closed: () => undefined });
rawHub.advance(10);
for (let index = 0; index < 12; index++)
    attacker.send(Uint8Array.of(1, 2, 3, index));
rawHub.advance(10);
(victim as Connection | null)?.update();
checks.check('pacotes fora do protocolo derrubam a conexão', garbageLog.join(',') === `opened,${DISCONNECT.protocol}`, garbageLog.join(','));
checks.finish();
