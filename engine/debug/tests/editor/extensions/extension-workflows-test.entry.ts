import { EditorEvents, type EditorEventName } from '@/engine/editor/extensions/events/editor-events';
import { notifyEventListeners, type EventListenerContribution } from '@/engine/editor/extensions/events/event-listener-contribution';
import { EventQueue } from '@/engine/editor/extensions/events/event-queue';
import type { WorkflowContribution, WorkflowStep } from '@/engine/editor/extensions/workflows/workflow-contribution';
import { WorkflowRunner, type WorkflowProgress } from '@/engine/editor/extensions/workflows/workflow-runner';
import { connectWorkflowTriggers } from '@/engine/editor/extensions/workflows/workflow-triggers';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Fluxos de trabalho e eventos das extensões');
const CLOCK_STEP_MS = 10;
function createBench() {
    const log: string[] = [];
    let clock = 0;
    const runner = new WorkflowRunner({ started: (workflow) => log.push(`${workflow.id}:início`), finished: (workflow, result) => log.push(`${workflow.id}:${result.outcome}`) }, () => (clock += CLOCK_STEP_MS));
    return { runner, log };
}
function step(title: string, run: WorkflowStep['run'] = async () => undefined): WorkflowStep {
    return { title, run };
}
function workflow(id: string, steps: WorkflowStep[], trigger: EditorEventName | null = null): WorkflowContribution {
    return { id, title: id, description: '', icon: null, trigger, steps };
}
function createGate() {
    let open: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { opened, open: () => open() };
}
async function running(): Promise<void> {
    const { runner, log } = createBench();
    const order: string[] = [];
    const snapshots: WorkflowProgress[] = [];
    runner.subscribe(() => {
        if (runner.progress)
            snapshots.push(runner.progress);
    });
    const outcome = await runner.run(workflow('revisar', [
        step('contar', async () => {
            order.push('contar');
        }),
        step('conferir', async (control) => {
            order.push('conferir');
            control.report(0.5, 'metade');
            control.report(7, null);
            control.report(Number.NaN, null);
        }),
    ]));
    checks.check('os passos rodam em ordem e o fluxo conclui', outcome === 'done' && order.join(',') === 'contar,conferir', order.join(','));
    checks.check('o relator recebe o início e o fim', log.join(' ') === 'revisar:início revisar:done', log.join(' '));
    const half = snapshots.find((snapshot) => snapshot.message === 'metade');
    checks.check('o progresso soma os passos já feitos ao passo atual', half?.fraction === 0.75 && half.stepIndex === 1 && half.stepTitle === 'conferir' && half.stepCount === 2, String(half?.fraction));
    const fractions = snapshots.filter((snapshot) => snapshot.stepIndex === 1).map((snapshot) => snapshot.fraction);
    checks.check('o progresso de um passo fica entre 0 e 1', fractions.includes(1) && fractions.at(-1) === 0.5, fractions.join(','));
    checks.check('ao terminar, não há progresso e o resultado fica guardado', runner.progress === null && runner.resultOf('revisar')?.outcome === 'done' && runner.resultOf('revisar')?.durationMs === CLOCK_STEP_MS);
    checks.check('um fluxo que nunca rodou não tem resultado', runner.resultOf('outro') === null);
}
async function failing(): Promise<void> {
    const { runner, log } = createBench();
    let reached = false;
    const outcome = await runner.run(workflow('quebrar', [
        step('falhar', async () => {
            throw new Error('falha de propósito');
        }),
        step('depois', async () => {
            reached = true;
        }),
    ]));
    checks.check('um passo que falha interrompe o fluxo', outcome === 'failed' && !reached && log.at(-1) === 'quebrar:failed');
    const next = await runner.run(workflow('seguinte', [step('ok')]));
    checks.check('depois de uma falha, o próximo fluxo roda normalmente', next === 'done');
}
async function cancelling(): Promise<void> {
    const { runner } = createBench();
    let sawCancelled = false;
    let reached = false;
    let cancellingShown = false;
    runner.subscribe(() => {
        cancellingShown ||= runner.progress?.cancelling === true;
    });
    const outcome = await runner.run(workflow('longo', [
        step('primeiro', async (control) => {
            runner.cancel('longo');
            sawCancelled = control.cancelled;
        }),
        step('segundo', async () => {
            reached = true;
        }),
    ]));
    checks.check('cancelar avisa o passo em curso e pula os seguintes', outcome === 'cancelled' && sawCancelled && !reached);
    checks.check('o progresso mostra que o fluxo está cancelando', cancellingShown);
    const finished = await runner.run(workflow('curto', [
        step('único', async () => {
            runner.cancel('curto');
        }),
    ]));
    checks.check('cancelar no último passo ainda conclui o fluxo', finished === 'done');
}
async function queueing(): Promise<void> {
    const { runner, log } = createBench();
    const gate = createGate();
    const first = runner.run(workflow('a', [step('esperar', () => gate.opened)]));
    const second = workflow('b', [step('ok')]);
    const queued = runner.run(second);
    checks.check('pedir de novo um fluxo já na fila devolve a mesma espera', runner.run(second) === queued);
    checks.check('isPending cobre o fluxo em curso e os da fila', runner.isPending('a') && runner.isPending('b') && !runner.isPending('c'));
    const dropped = runner.run(workflow('c', [step('ok')]));
    runner.cancel('c');
    gate.open();
    const outcomes = await Promise.all([first, queued, dropped]);
    checks.check('a fila roda na ordem e um fluxo cancelado na fila não chega a rodar', outcomes.join(',') === 'done,done,cancelled' && log.join(' ') === 'a:início a:done b:início b:done', log.join(' '));
    const blocker = createGate();
    const current = runner.run(workflow('d', [step('esperar', () => blocker.opened), step('nunca')]));
    const waiting = runner.run(workflow('e', [step('ok')]));
    runner.cancel();
    blocker.open();
    checks.check('cancelar sem id cancela o fluxo em curso e esvazia a fila', (await Promise.all([current, waiting])).join(',') === 'cancelled,cancelled');
    const hold = createGate();
    const held = runner.run(workflow('cheio', [step('esperar', () => hold.opened)]));
    const filled = Array.from({ length: 16 }, (_, index) => runner.run(workflow(`fila-${index}`, [step('ok')])));
    const overflow = await runner.run(workflow('excesso', [step('ok')]));
    checks.check('com a fila cheia, o pedido extra é recusado', overflow === 'cancelled' && !runner.isPending('excesso'));
    hold.open();
    await Promise.all([held, ...filled]);
}
function events(): void {
    const hub = new EditorEvents();
    const received: unknown[] = [];
    const unsubscribe = hub.on('projectSaved', (payload) => received.push(payload));
    hub.on('projectSaved', () => unsubscribe());
    hub.emit('projectSaved', 1);
    hub.emit('projectSaved', 2);
    hub.emit('sceneChanged', 3);
    checks.check('um ouvinte recebe só o seu evento até cancelar a inscrição', received.join(',') === '1', received.join(','));
    const flushes: Array<() => void> = [];
    const delivered: string[] = [];
    const queue: EventQueue<'a' | 'b'> = new EventQueue<'a' | 'b'>((name) => {
        delivered.push(name);
        queue.push('b');
    }, (flush) => flushes.push(flush));
    queue.push('a');
    queue.push('a');
    queue.push('b');
    checks.check('vários avisos agendam uma única entrega', flushes.length === 1 && delivered.length === 0);
    flushes[0]();
    checks.check('cada evento é entregue uma vez, e o que a entrega dispara é ignorado', delivered.join(',') === 'a,b' && flushes.length === 1, delivered.join(','));
    queue.push('b');
    checks.check('depois da entrega, um aviso novo agenda outra', flushes.length === 2);
    queue.clear();
    flushes[1]();
    checks.check('clear descarta o que ainda não foi entregue', delivered.length === 2);
    const calls: string[] = [];
    const listener = (id: string, event: EditorEventName): EventListenerContribution => ({ id, event, notify: (payload) => calls.push(`${id}:${String(payload)}`) });
    notifyEventListeners([listener('um', 'projectSaved'), listener('dois', 'sceneChanged'), listener('três', 'projectSaved')], 'projectSaved', 7);
    checks.check('só os ouvintes do evento são chamados', calls.join(' ') === 'um:7 três:7', calls.join(' '));
}
function triggering(): void {
    const hub = new EditorEvents();
    const started: string[] = [];
    const pending = new Set<string>(['ocupado']);
    const registered = [workflow('salvar', [], 'projectSaved'), workflow('ocupado', [], 'projectSaved'), workflow('manual', []), workflow('simular', [], 'playModeChanged')];
    const disconnect = connectWorkflowTriggers(hub, { list: () => registered }, { isPending: (id) => pending.has(id), run: (item) => started.push(item.id) });
    hub.emit('projectSaved', null);
    checks.check('o evento dispara os fluxos com esse gatilho que não estão pendentes', started.join(',') === 'salvar', started.join(','));
    hub.emit('playModeChanged', 'playing');
    checks.check('cada gatilho dispara só os próprios fluxos', started.join(',') === 'salvar,simular', started.join(','));
    disconnect();
    hub.emit('projectSaved', null);
    checks.check('desconectar para de disparar', started.length === 2);
}
async function main(): Promise<void> {
    await running();
    await failing();
    await cancelling();
    await queueing();
    events();
    triggering();
    checks.finish();
}
void main();
