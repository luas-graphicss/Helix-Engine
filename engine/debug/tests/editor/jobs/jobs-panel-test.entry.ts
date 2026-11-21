import { LOAD_BUCKETS, QUIET_AFTER_MS, advanceJobMonitor, averageLoad, createJobMonitor, threadLoad } from '@/engine/editor/jobs/job-load';
import { runJobBenchmark } from '@/engine/editor/operations/jobs/job-benchmark-operations';
import { updateJobSettings } from '@/engine/editor/operations/jobs/job-settings-operations';
import type { JobSystemSnapshot } from '@/engine/jobs/system/job-system';
import { failureOf } from '../../jobs/job-test-system';
import { createCheckList } from '../../support/check-list';
import { benchmarkIn, createJobsPanelStage, renderHistory, renderPanel, renderSettings, renderThreads } from './jobs-panel-stage';
const checks = createCheckList('Painel Jobs');
function includesAll(markup: string, parts: readonly string[]): boolean {
    return parts.every((part) => markup.includes(part));
}
function missing(markup: string, parts: readonly string[]): string {
    return parts.filter((part) => !markup.includes(part)).join(' | ');
}
const stage = createJobsPanelStage(3);
const { scene, session, history, jobs } = stage;
const idleParts = ['Threads', 'Histórico', 'Configuração', 'T1', 'T2', 'T3', 'ociosa', 'Nenhum job rodou nesta sessão.', 'Medir ganho das threads'];
const idlePanel = renderPanel(stage);
checks.check('o painel abre na aba Threads com uma raia por thread', includesAll(idlePanel, idleParts) && !idlePanel.includes('T4'), missing(idlePanel, idleParts));
checks.check('o rodapé resume threads, memória e fila', idlePanel.includes('3 threads · memória compartilhada · 0 na fila · 0 rodando · 0 concluídos'));
checks.check('histórico vazio diz o que vai aparecer', renderHistory(stage).includes('Os jobs que terminarem aparecem aqui'));
updateJobSettings(session, { threads: 2 });
checks.check('mudar a quantidade vale na cena e no sistema na hora', scene.jobs.threads === 2 && jobs.threadCount === 2 && history.undoDepth === 1);
updateJobSettings(session, { threads: 2 });
checks.check('valor repetido não cria passo no histórico', history.undoDepth === 1);
history.undo();
checks.check('desfazer devolve as threads automáticas', scene.jobs.threads === 0 && jobs.threadCount === 3);
updateJobSettings(session, { maxQueued: 300 });
checks.check('a fila máxima é ajustada para um dos limites', scene.jobs.maxQueued === 256);
updateJobSettings(session, { enabled: false });
checks.check('desligar as threads passa os jobs para a thread principal', !scene.jobs.enabled && jobs.snapshot().mode === 'inline' && renderThreads(stage).includes('Threads desligadas nesta cena'));
checks.check('o rodapé avisa quando roda na thread principal', renderPanel(stage).includes('thread principal · memória compartilhada'));
const settingsParts = ['Usar threads', 'Quantidade', 'Tempo limite', 'Fila máxima', '4.096', '16.384', 'Dispositivo', 'Núcleos', 'Em uso', 'thread principal', 'Memória', 'compartilhada', 'Medição', 'Medir ganho'];
const settings = renderSettings(stage);
checks.check('a aba Configuração mostra threads, dispositivo e medição', includesAll(settings, settingsParts), missing(settings, settingsParts));
history.undo();
checks.check('desfazer religa as threads', scene.jobs.enabled && jobs.snapshot().mode === 'threads' && renderSettings(stage).includes('3 threads'));
const measured = renderSettings(stage, benchmarkIn({ status: 'done', result: { threads: 7, singleMs: 412.4, parallelMs: 70.9, speedup: 5.82 } }));
checks.check('a medição concluída mostra os tempos e o ganho', includesAll(measured, ['412 ms', '7 threads', '70,9 ms', '5,8×']), missing(measured, ['412 ms', '7 threads', '70,9 ms', '5,8×']));
checks.check('a medição em andamento trava o botão', renderSettings(stage, benchmarkIn({ status: 'running' })).includes('Medindo…'));
checks.check('a medição que falha explica o motivo', renderSettings(stage, benchmarkIn({ status: 'failed', message: 'o sistema de jobs foi parado' })).includes('Não foi possível medir. o sistema de jobs foi parado'));
await jobs.schedule(jobs.program('() => 1'), null, { name: 'pathfinding', label: 'EnemyBrain' });
await failureOf(jobs.schedule(jobs.program('() => { throw new Error("sem rota"); }'), null, { name: 'flood-fill' }));
await jobs.parallelFor(4, jobs.program('(input, job) => job.index'), null, { name: 'chunks', batchSize: 2 });
const historyParts = ['Job', 'Origem', 'Thread', 'Espera', 'Execução', 'Estado', 'pathfinding', 'EnemyBrain', 'flood-fill', 'falhou', 'sem rota', 'chunks', 'lote 2/2', 'concluído'];
const historyMarkup = renderHistory(stage);
checks.check('o histórico lista job, origem, thread, tempos e estado', includesAll(historyMarkup, historyParts), missing(historyMarkup, historyParts));
checks.check('o histórico mostra primeiro o job mais recente', historyMarkup.indexOf('chunks') < historyMarkup.indexOf('pathfinding'));
const busyPanel = renderPanel(stage);
checks.check('depois de rodar jobs o rodapé conta concluídos e falhas', busyPanel.includes('3 concluídos · 1 falha') && !busyPanel.includes('Nenhum job rodou'));
const base = jobs.snapshot();
function pictureAt(now: number, busyMs: readonly number[]): JobSystemSnapshot {
    return { ...base, now, lastActivityAt: now, threads: base.threads.map((thread, index) => ({ ...thread, busyMs: busyMs[index] })) };
}
let monitor = createJobMonitor(pictureAt(0, [0, 0, 0]));
monitor = advanceJobMonitor(monitor, pictureAt(200, [200, 100, 0]));
monitor = advanceJobMonitor(monitor, pictureAt(400, [200, 200, 0]));
const loadOf = (thread: number): string => threadLoad(monitor.samples, thread).map((bucket) => bucket.load).join(',');
checks.check('a carga de cada thread sai do tempo ocupado entre amostras', loadOf(0) === '1,0' && loadOf(1) === '0.5,0.5' && loadOf(2) === '0,0');
checks.near('a carga média resume os intervalos', averageLoad(threadLoad(monitor.samples, 1)), 0.5);
const quiet = { ...pictureAt(400 + QUIET_AFTER_MS + 1, [200, 200, 0]), lastActivityAt: 400 };
checks.check('sem atividade o monitor para de gerar retratos novos', advanceJobMonitor(monitor, quiet) === monitor);
checks.check('mudança de threads atualiza o monitor mesmo parado', advanceJobMonitor(monitor, { ...quiet, threadCount: 2 }) !== monitor);
let long = monitor;
for (let step = 3; step < 120; step++)
    long = advanceJobMonitor(long, pictureAt(step * 200, [0, 0, 0]));
checks.check('o monitor guarda só a janela mais recente', long.samples.length === LOAD_BUCKETS + 1);
const working = pictureAt(600, [400, 200, 0]);
const [firstThread, ...otherThreads] = working.threads;
const live = advanceJobMonitor(monitor, { ...working, running: 1, threads: [{ ...firstThread, job: { name: 'chunks', label: 'World', batch: { index: 1, count: 8 }, startedAt: -900 } }, ...otherThreads] });
const liveMarkup = renderThreads(stage, live);
checks.check('a raia mostra o job em andamento, o lote e a carga', includesAll(liveMarkup, ['chunks · lote 2/8 · 1.500 ms', '67%', 'ociosa', '−10 s', 'agora']), missing(liveMarkup, ['chunks · lote 2/8 · 1.500 ms', '67%', 'ociosa']));
const result = await runJobBenchmark(session);
checks.check('a medição roda nas threads e registra o resultado no console', result.threads === 3 && result.singleMs > 0 && result.parallelMs > 0 && Number.isFinite(result.speedup) && stage.logged.some((message) => message.includes('Medição de jobs') && message.includes('3 threads')));
checks.check('a medição aparece no histórico com o nome de cada passo', jobs.snapshot().history.some((record) => record.name === 'medição · 1 thread') && jobs.snapshot().history.some((record) => record.name === 'medição · 3 threads'));
jobs.dispose();
checks.finish();
