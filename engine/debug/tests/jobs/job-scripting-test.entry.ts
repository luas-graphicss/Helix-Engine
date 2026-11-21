import { API_MANIFEST } from '@/engine/scripting/api-manifest';
import { createJobsApi } from '@/engine/scripting/api/jobs';
import type { RuntimeHost } from '@/engine/scripting/runtime/runtime-host';
import { isTaskCancelled } from '@/engine/scripting/runtime/script-errors';
import { HELIX_DECLARATIONS } from '@/engine/scripting/typings/helix-dts';
import { createCheckList } from '../support/check-list';
import { createTestJobSystem, failureOf, nextTurn } from './job-test-system';
interface BatchScope {
    readonly start: number;
    readonly end: number;
    readonly output: Float32Array;
}
const checks = createCheckList('Sistema de jobs nos scripts');
const jobs = createTestJobSystem(2);
const api = createJobsApi({ jobs, current: null } as unknown as RuntimeHost);
const scripted = createJobsApi({ jobs, current: { handle: { name: 'EnemyBrain' } } } as unknown as RuntimeHost);
const manifest = API_MANIFEST.find((namespace) => namespace.name === 'jobs');
checks.check('a API entrega cada membro que o manifesto promete', manifest !== undefined && manifest.members.length === 8 && manifest.members.every((member) => member in api));
checks.check('as declarações de tipo expõem helix.jobs', HELIX_DECLARATIONS.includes('readonly jobs: JobsApi') && HELIX_DECLARATIONS.includes('export const jobs: JobsApi') && HELIX_DECLARATIONS.includes('export interface JobsApi'));
checks.check('a API informa threads e memória compartilhada', api.threads === 2 && api.sharedMemory);
const product = await api.run((input: { a: number; b: number }) => input.a * input.b, { a: 6, b: 7 });
checks.check('uma função do script roda como job e devolve o resultado', product === 42);
function findPath(input: { steps: number }) {
    return input.steps + 1;
}
const named = api.run(findPath, { steps: 4 });
checks.check('o job herda o nome da função', named.name === 'findPath' && (await named) === 5 && named.status === 'completed');
const renamed = scripted.run(findPath, { steps: 1 }, { name: 'patrol' });
await renamed;
const record = jobs.snapshot().history.at(-1);
checks.check('o histórico mostra o nome escolhido e o script de origem', record?.name === 'patrol' && record.label === 'EnemyBrain');
const heights = api.createBuffer('float32', 64);
await api.parallelFor(64, (input: { scale: number }, job: BatchScope) => {
    for (let item = job.start; item < job.end; item++)
        job.output[item - job.start] = item * input.scale;
}, { scale: 2 }, { output: heights, batchSize: 16 });
checks.check('parallelFor preenche o array de saída a partir do script', heights.every((value, item) => value === item * 2));
const batches = await api.parallelFor(6, (_input: unknown, job: BatchScope) => job.end - job.start, null, { batchSize: 4 });
checks.check('parallelFor devolve o retorno de cada lote', Array.isArray(batches) && batches.join(',') === '4,2');
const slowest = api.run((input: number) => input * 2, 10, { priority: 'low' });
const fastest = api.run((input: number) => input * 3, 10, { priority: 'high', dependsOn: [slowest] });
checks.check('all aguarda os handles e mantém a ordem pedida', (await api.all([fastest, slowest])).join(',') === '30,20');
const instrumented = new Function('__hxdbg', 'return function probe(input) { __hxdbg.l[1]&&__hxdbg.h(1,()=>({input})); return input + 1; }')({ l: [], h: () => undefined, s: () => undefined });
checks.check('função instrumentada pelo depurador roda na thread', (await api.run(instrumented, 1)) === 2);
const endless = api.run(() => new Promise(() => undefined), null, { timeout: 0 });
const endlessFailure = failureOf(endless);
await nextTurn();
api.cancel(endless);
checks.check('job cancelado rejeita como tarefa cancelada', isTaskCancelled(await endlessFailure) && endless.status === 'cancelled');
const outside = 3;
const captured = await failureOf(api.run(() => outside + 1));
checks.check('variável de fora da função é explicada ao script', captured instanceof Error && captured.message.includes('variáveis de fora'));
const stats = api.stats();
checks.check('stats resume o que rodou', stats.threads === 2 && stats.mode === 'threads' && stats.completed >= 10 && stats.failed === 1 && stats.cancelled === 1 && stats.running === 0);
checks.throws('job precisa ser uma função', () => api.run('patrulhar'), 'helix.jobs.run: o job precisa ser uma função');
checks.throws('função nativa é recusada com o membro', () => api.run(Math.max), 'helix.jobs.run: Funções nativas');
checks.throws('prioridade desconhecida lista as aceitas', () => api.run(findPath, null, { priority: 'urgent' }), '"high", "normal", "low"');
checks.throws('timeout negativo é recusado', () => api.run(findPath, null, { timeout: -1 }), 'não pode ser negativo');
checks.throws('output precisa ser um typed array', () => api.run(findPath, null, { output: [1, 2] }), 'typed array');
checks.throws('transfer recusa memória compartilhada', () => api.run(findPath, null, { transfer: [heights] }), 'memória compartilhada');
checks.throws('dependsOn recusa o que não é handle', () => api.run(findPath, null, { dependsOn: [{}] }), 'handle devolvido');
checks.throws('cancel recusa o que não é handle', () => api.cancel({}), 'helix.jobs.cancel');
checks.throws('contagem precisa ser um número', () => api.parallelFor('muitos', findPath), 'a contagem');
checks.throws('tipo de buffer desconhecido lista os aceitos', () => api.createBuffer('float128', 4), '"float32"');
jobs.dispose();
checks.finish();
