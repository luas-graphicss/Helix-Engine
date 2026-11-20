import { DISCONNECT } from '@/engine/net/transport/disconnect-reason';
import { PERFECT_CONDITIONS, type NetworkConditions } from '@/engine/net/transport/network-conditions';
import type { NetValue } from '@/engine/net/wire/net-value';
import { createCheckList } from '../support/check-list';
import { SESSION_ADDRESS, createSessionWorld, requireObject } from './session-test-support';
const checks = createCheckList('Sessão de jogo: entrada, objetos, variáveis e RPCs');
const HOME: NetworkConditions = { latencyMs: 30, jitterMs: 5, lossRate: 0.02, duplicateRate: 0.01, reorderRate: 0.02 };
const world = createSessionWorld(21, HOME);
const ana = world.join('Ana');
world.run(400);
const bia = world.join('  Bia\u0007  ');
world.run(400);
checks.check('dois clientes entram e recebem ids em ordem', ana.client.phase === 'connected' && bia.client.phase === 'connected' && ana.client.localId === 1 && bia.client.localId === 2);
checks.check('o servidor anuncia quem entrou, com o nome limpo', world.events.join(',') === 'joined:1:Ana,joined:2:Bia');
checks.check('quem já estava é avisado de quem chega', ana.events.join(',') === 'connected,joined:2');
checks.check('quem chega recebe a lista inteira', bia.client.players.map((player) => player.name).join(',') === 'Ana,Bia' && bia.client.sessionId === SESSION_ADDRESS);
checks.check('o relógio do cliente acompanha o do servidor', Math.abs(ana.client.serverTimeMs - world.server.timeMs) < 15, `diferença de ${ana.client.serverTimeMs - world.server.timeMs} ms`);
const stranger = world.join('Caio', { schema: 'schema-b' });
world.run(400);
checks.check('projeto de versão diferente é recusado', stranger.events.join(',') === `disconnected:${DISCONNECT.rejected}:schema` && stranger.client.phase === 'closed');
const crate = world.server.objects.spawn({
    kind: 'crate',
    ownerId: 1,
    variables: [
        { name: 'health', initial: 100, writer: 'server' },
        { name: 'label', initial: '', writer: 'owner' },
    ],
});
world.run(300);
const crateOnAna = requireObject(ana.client.objects.get(crate.id));
const crateOnBia = requireObject(bia.client.objects.get(crate.id));
checks.check('objeto criado no servidor aparece nos clientes com dono e tipo', crateOnAna.kind === 'crate' && crateOnBia.ownerId === 1 && crateOnBia.variables.get('health') === 100);
const healthSeen: string[] = [];
crateOnBia.variables.watch('health', (value, previous) => healthSeen.push(`${String(previous)}>${String(value)}`));
crate.variables.set('health', 75);
world.run(300);
checks.check('variável alterada no servidor chega aos clientes', crateOnAna.variables.get('health') === 75 && healthSeen.join(',') === '100>75');
checks.check('o dono escreve na variável que é dele', ana.client.setVariable(crate.id, 'label', 'da Ana'));
checks.check('quem não é dono não escreve', !bia.client.setVariable(crate.id, 'label', 'da Bia') && !ana.client.setVariable(crate.id, 'health', 1));
world.run(300);
checks.check('a escrita do dono chega ao servidor e aos outros', crate.variables.get('label') === 'da Ana' && crateOnBia.variables.get('label') === 'da Ana');
const serverCalls: string[] = [];
world.server.rpc.register('shout', ({ senderId, objectId }, args) => serverCalls.push(`${senderId}:${objectId}:${JSON.stringify(args)}`));
world.server.rpc.register('open', ({ senderId }) => serverCalls.push(`open:${senderId}`), { requireOwnership: true });
world.server.rpc.register('ping', ({ senderId }) => serverCalls.push(`ping:${senderId}`), { perSecond: 5 });
ana.client.callServer('shout', 0, ['olá', { volume: 3 }]);
bia.client.callServer('open', crate.id, []);
ana.client.callServer('open', crate.id, []);
for (let index = 0; index < 30; index++)
    bia.client.callServer('ping', 0, []);
world.run(400);
checks.check('RPC do cliente chega ao servidor com remetente e argumentos', serverCalls.includes('1:0:["olá",{"volume":3}]'));
checks.check('RPC que exige posse só vale para o dono', serverCalls.includes('open:1') && !serverCalls.includes('open:2'));
const pings = serverCalls.filter((call) => call === 'ping:2').length;
checks.check('RPC acima do limite por segundo é descartada', pings >= 5 && pings <= 8, `passaram ${pings}`);
const anaHeard: NetValue[][] = [];
const biaHeard: NetValue[][] = [];
ana.client.rpc.register('notice', (_context, args) => anaHeard.push(args));
bia.client.rpc.register('notice', (_context, args) => biaHeard.push(args));
world.server.callClients('notice', 0, ['todos']);
world.server.callClients('notice', 0, ['só ana'], { only: [1] });
world.server.callClients('notice', 0, ['menos ana'], { except: 1 });
world.run(300);
checks.check('RPC do servidor respeita o público', anaHeard.map(String).join('|') === 'todos|só ana' && biaHeard.map(String).join('|') === 'todos|menos ana');
world.server.objects.despawn(crate.id);
world.run(300);
checks.check('objeto removido no servidor some dos clientes', !ana.client.objects.get(crate.id) && !bia.client.objects.get(crate.id));
const beacon = world.server.objects.spawn({ kind: 'beacon', variables: [{ name: 'color', initial: 'azul', writer: 'server' }] });
beacon.variables.set('color', 'verde');
world.run(200);
const late = world.join('Davi');
world.run(400);
checks.check('quem entra depois recebe os objetos no estado atual', late.client.objects.get(beacon.id)?.variables.get('color') === 'verde' && late.client.localId === 3);
const full = createSessionWorld(22, PERFECT_CONDITIONS, { maxPlayers: 1 });
full.join('Um');
full.run(100);
const overflow = full.join('Dois');
full.run(100);
checks.check('sessão cheia recusa o excedente', overflow.events.join(',') === `disconnected:${DISCONNECT.rejected}:full` && full.server.players.length === 1);
const gated = createSessionWorld(23, PERFECT_CONDITIONS);
gated.server.approver = ({ name, ticket }) => {
    if (ticket === 'convite')
        return { accepted: true, name: `${name} (convidado)` };
    return name === 'Lento' ? Promise.resolve({ accepted: false, reason: 'sem convite' }) : { accepted: false, reason: 'banido' };
};
const guest = gated.join('Eva', { ticket: 'convite' });
const banned = gated.join('Fábio');
const slow = gated.join('Lento');
gated.run(100);
await Promise.resolve();
gated.run(100);
checks.check('o porteiro aceita e pode renomear', guest.client.phase === 'connected' && gated.events.join(',') === 'joined:1:Eva (convidado)');
checks.check('o porteiro recusa com o motivo', banned.events.join(',') === `disconnected:${DISCONNECT.rejected}:banido`);
checks.check('o porteiro assíncrono também decide', slow.events.join(',') === `disconnected:${DISCONNECT.rejected}:sem convite`);
gated.server.approver = () => {
    throw new Error('porteiro quebrado');
};
const unlucky = gated.join('Gil');
gated.run(100);
checks.check('porteiro que falha recusa e avisa', unlucky.client.phase === 'closed' && gated.events.includes('approval-failed:porteiro quebrado'));
world.server.kick(3, 'trapaça');
world.run(300);
checks.check('expulsão fecha o cliente com o motivo e sem reconexão', late.events.at(-1) === `disconnected:${DISCONNECT.kicked}:trapaça` && late.client.phase === 'closed');
checks.check('os outros ficam sabendo da saída', ana.events.includes(`left:3:${DISCONNECT.kicked}:trapaça`) && world.events.includes(`left:3:${DISCONNECT.kicked}:trapaça`));
bia.client.leave();
world.run(300);
checks.check('sair avisa o servidor na hora', world.events.includes(`left:2:${DISCONNECT.left}`) && world.server.players.length === 1);
for (let index = 0; index < 120; index++)
    ana.client.callServer(`unknown-${index % 3}`, 0, []);
world.run(600);
checks.check('insistir em RPCs que não existem derruba o cliente', ana.events.at(-1) === `disconnected:${DISCONNECT.flood}` && world.server.players.length === 0, ana.events.at(-1));
checks.finish();
