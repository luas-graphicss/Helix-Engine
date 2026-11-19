import type { SpawnPlan } from '@/engine/vfx-graph/compiler/spawn-plan';
import { PopulationEstimate } from '@/engine/vfx-graph/runtime/population-estimate';
import { SpawnScheduler } from '@/engine/vfx-graph/runtime/spawn-scheduler';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Agenda de emissão do Visual Effect Graph');
const FRAME = 1 / 60;
function spawnedOver(plan: SpawnPlan, seconds: number, delta = FRAME): number {
    const scheduler = new SpawnScheduler(plan);
    let total = 0;
    for (let frame = 0; frame < Math.round(seconds / delta); frame++)
        total += scheduler.advance(delta);
    return total;
}
function rates(): void {
    const steady: SpawnPlan = { rate: 90, bursts: [], duration: 5, looping: true };
    checks.check('a taxa constante entrega o total certo apesar das frações por quadro', Math.abs(spawnedOver(steady, 2) - 180) <= 1);
    checks.check('a taxa não depende do tamanho do quadro', Math.abs(spawnedOver(steady, 2, 1 / 144) - 180) <= 1);
    const finite: SpawnPlan = { rate: 100, bursts: [], duration: 1, looping: false };
    checks.check('um ciclo único para de emitir ao fim da duração', Math.abs(spawnedOver(finite, 3) - 100) <= 1);
    checks.check('duração zero não emite nem trava', spawnedOver({ rate: 100, bursts: [], duration: 0, looping: true }, 1) === 0);
}
function bursts(): void {
    const single: SpawnPlan = { rate: 0, bursts: [{ time: 0, count: 50, interval: 0 }], duration: 2, looping: false };
    const scheduler = new SpawnScheduler(single);
    checks.check('a rajada do instante zero dispara no primeiro quadro', scheduler.advance(FRAME) === 50);
    checks.check('a rajada não dispara de novo no mesmo ciclo', scheduler.advance(FRAME) === 0);
    scheduler.reset();
    checks.check('reiniciar rearma a rajada', scheduler.advance(FRAME) === 50);
    const looping: SpawnPlan = { ...single, looping: true };
    checks.check('em repetição a rajada dispara uma vez por ciclo', spawnedOver(looping, 6) === 150);
    const repeating: SpawnPlan = { rate: 0, bursts: [{ time: 0.5, count: 10, interval: 1 }], duration: 10, looping: false };
    checks.check('a rajada com intervalo repete dentro do ciclo', spawnedOver(repeating, 4) === 40);
    const late: SpawnPlan = { rate: 0, bursts: [{ time: 5, count: 10, interval: 0 }], duration: 2, looping: true };
    checks.check('uma rajada marcada para depois do ciclo nunca dispara', spawnedOver(late, 6) === 0);
    const coarse = new SpawnScheduler({ rate: 0, bursts: [{ time: 0.1, count: 7, interval: 0.1 }], duration: 10, looping: false });
    checks.check('um quadro longo dispara todas as rajadas que cruzou', coarse.advance(0.35) === 21);
}
function population(): void {
    const estimate = new PopulationEstimate();
    estimate.record(0, 100);
    estimate.record(1, 50);
    checks.check('partículas dentro do tempo de vida contam como vivas', estimate.alive(1.5, 2, 1000) === 150);
    checks.check('nascimentos mais velhos que o tempo de vida saem da conta', estimate.alive(2.5, 2, 1000) === 50);
    estimate.record(2.6, 5000);
    checks.check('a estimativa nunca passa da capacidade', estimate.alive(2.7, 2, 1000) === 1000);
    estimate.reset();
    checks.check('reiniciar zera a população', estimate.alive(3, 2, 1000) === 0);
}
rates();
bursts();
population();
checks.finish();
