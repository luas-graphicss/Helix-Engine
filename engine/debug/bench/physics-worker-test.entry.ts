import * as vec3 from '@/engine/core/math/vec3';
import { PhysicsWorkerCore } from '@/engine/physics/worker/physics-worker-core';
import { PhysicsWorkerLink, type PhysicsChannel } from '@/engine/physics/worker/physics-worker-link';
import type { PhysicsReply, PhysicsRequest } from '@/engine/physics/worker/physics-protocol';
import type { PhysicsBackend, PhysicsWorld } from '@/engine/physics/world/physics-world';
import { buildStackScenario } from './physics-benchmark';
const FRAME_DT = 1 / 60;
const BODIES = 24;
const FRAMES = 240;
const MIRROR_TOLERANCE = 1e-5;
const LOCAL_TOLERANCE = 1e-3;
interface LoopChannel extends PhysicsChannel {
    delivered: number;
    failNow(message: string): void;
    handled: number;
}
function createLoopChannel(core: PhysicsWorkerCore): LoopChannel {
    let onReply: ((reply: PhysicsReply) => void) | null = null;
    let onFailure: ((message: string) => void) | null = null;
    let closed = false;
    const channel: LoopChannel = {
        delivered: 0,
        handled: 0,
        post(request: PhysicsRequest) {
            if (closed)
                return;
            setTimeout(() => {
                if (closed)
                    return;
                channel.handled++;
                core.handle(request, (reply) => {
                    channel.delivered++;
                    setTimeout(() => {
                        if (!closed)
                            onReply?.(reply);
                    }, 0);
                });
            }, 0);
        },
        onReply(handler) {
            onReply = handler;
        },
        onFailure(handler) {
            onFailure = handler;
        },
        close() {
            closed = true;
        },
        failNow(message) {
            onFailure?.(message);
        },
    };
    return channel;
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function settle(link: PhysicsWorkerLink, timeoutMs = 2000): Promise<void> {
    const started = performance.now();
    while (link.busy) {
        if (performance.now() - started > timeoutMs)
            throw new Error('o elo com o worker não respondeu a tempo.');
        await sleep(0);
    }
}
function maxPositionDeviation(a: PhysicsWorld, b: PhysicsWorld): number {
    let worst = 0;
    for (const body of a.bodies) {
        const other = b.bodies.find((candidate) => candidate.id === body.id);
        if (!other)
            return Number.POSITIVE_INFINITY;
        worst = Math.max(worst, vec3.distance(body.position, other.position));
    }
    return worst;
}
interface Check {
    name: string;
    ok: boolean;
    detail: string;
}
const checks: Check[] = [];
function check(name: string, ok: boolean, detail = ''): void {
    checks.push({ name, ok, detail });
    console.log(`${ok ? '  ok ' : 'FALHA'} ${name}${detail ? ` · ${detail}` : ''}`);
}
async function runBackend(backend: Exclude<PhysicsBackend, 'local'>, local: PhysicsWorld): Promise<void> {
    console.log(`\n[${backend}]`);
    const core = new PhysicsWorkerCore();
    const channel = createLoopChannel(core);
    const mirror = buildStackScenario(BODIES, 'medium');
    mirror.stepBudgetMs = Infinity;
    let fallback: string | null = null;
    mirror.events.onBackendFallback = (message) => {
        fallback = message;
    };
    const link = new PhysicsWorkerLink(mirror, backend, channel);
    mirror.attachRemote(link);
    await settle(link);
    check(`${backend}: worker pronto`, link.busy === false && core.authoritativeWorld !== null);
    let mainThreadMs = 0;
    let framesWithPoses = 0;
    for (let frame = 0; frame < FRAMES; frame++) {
        const started = performance.now();
        mirror.advance(FRAME_DT);
        mainThreadMs += performance.now() - started;
        await settle(link);
        if (mirror.stats.stepsLastAdvance > 0)
            framesWithPoses++;
    }
    const authoritative = core.authoritativeWorld!;
    check(`${backend}: corpos existentes apresentados ao worker`, authoritative.bodies.length === mirror.bodies.length, `${authoritative.bodies.length} de ${mirror.bodies.length}`);
    check(`${backend}: quadros aplicados ao espelho`, framesWithPoses >= FRAMES - 2, `${framesWithPoses}/${FRAMES} frames com passos`);
    check(`${backend}: stats do worker chegam ao espelho`, mirror.stats.backend === backend && mirror.stats.bodies === BODIES + 1, `backend=${mirror.stats.backend} corpos=${mirror.stats.bodies}`);
    const mirrorDeviation = maxPositionDeviation(mirror, authoritative);
    check(`${backend}: espelho = mundo autoritativo`, mirrorDeviation <= MIRROR_TOLERANCE, `desvio máx ${mirrorDeviation.toExponential(2)}`);
    const localDeviation = maxPositionDeviation(mirror, local);
    check(`${backend}: espelho ≈ simulação local`, localDeviation <= LOCAL_TOLERANCE, `desvio máx ${localDeviation.toExponential(2)} (pilha de ${BODIES} caixas, ${FRAMES} frames)`);
    console.log(`      custo na thread principal: ${(mainThreadMs / FRAMES).toFixed(3)} ms/frame (hooks + diff + postMessage) · ${(local.stats.stepMsAverage).toFixed(3)} ms/passo no local`);
    let pushed = mirror.bodies[1];
    for (const body of mirror.bodies)
        if (body.type === 'dynamic' && body.position[1] > pushed.position[1])
            pushed = body;
    const teleported = mirror.bodies[4];
    const removed = mirror.bodies[5];
    const teleportTarget = vec3.create(8, 6, 8);
    const beforePush = pushed.position[1];
    pushed.wake();
    pushed.linearVelocity[1] = 6;
    mirror.teleport(teleported, teleportTarget, teleported.orientation);
    mirror.removeBody(removed);
    for (let frame = 0; frame < 12; frame++) {
        mirror.advance(FRAME_DT);
        await settle(link);
    }
    check(`${backend}: velocidade escrita no espelho chega ao worker`, pushed.position[1] > beforePush + 0.8, `caixa ${pushed.id}: y ${beforePush.toFixed(3)} → ${pushed.position[1].toFixed(3)}`);
    const teleportedAuthoritative = authoritative.bodies.find((body) => body.id === teleported.id);
    check(`${backend}: teleporte chega ao worker`, teleportedAuthoritative !== undefined && vec3.distance(teleportedAuthoritative.position, teleportTarget) < 1.5, teleportedAuthoritative ? `distância do alvo ${vec3.distance(teleportedAuthoritative.position, teleportTarget).toFixed(3)} (caindo há 12 frames)` : 'corpo não encontrado');
    check(`${backend}: remoção chega ao worker`, authoritative.bodies.every((body) => body.id !== removed.id) && mirror.bodies.every((body) => body.id !== removed.id));
    check(`${backend}: contatos sintetizados para os scripts`, mirror.manifolds.length > 0, `${mirror.manifolds.length} manifolds`);
    const bodiesBefore = mirror.bodies.length;
    const sample = vec3.copy(vec3.create(), mirror.bodies[2].position);
    channel.failNow('falha simulada do worker');
    check(`${backend}: falha do worker vira fallback local`, mirror.backend === 'local' && fallback !== null && mirror.remoteLink === null, fallback ?? '');
    for (let frame = 0; frame < 30; frame++)
        mirror.advance(FRAME_DT);
    check(`${backend}: simulação local continua das poses do espelho`, mirror.bodies.length === bodiesBefore && mirror.stats.stepsLastAdvance > 0 && Number.isFinite(mirror.bodies[2].position[1]), `corpo 2: y ${sample[1].toFixed(3)} → ${mirror.bodies[2].position[1].toFixed(3)}`);
    check(`${backend}: canal fechado após a falha`, channel.handled > 0 && (() => {
        const handled = channel.handled;
        mirror.advance(FRAME_DT);
        return channel.handled === handled;
    })());
}
async function main(): Promise<void> {
    console.log(`Worker de física · pilha de ${BODIES} caixas · ${FRAMES} frames de 1/60 s · preset medium`);
    const local = buildStackScenario(BODIES, 'medium');
    local.stepBudgetMs = Infinity;
    for (let frame = 0; frame < FRAMES; frame++)
        local.advance(FRAME_DT);
    const sharedAvailable = typeof SharedArrayBuffer !== 'undefined';
    if (sharedAvailable)
        await runBackend('worker-shared', local);
    else
        console.log('\n[worker-shared] SharedArrayBuffer indisponível neste Node: modo pulado.');
    await runBackend('worker-copy', local);
    const failed = checks.filter((item) => !item.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} verificações passaram.`);
    if (failed.length > 0) {
        for (const item of failed)
            console.log(`  ✗ ${item.name}${item.detail ? ` · ${item.detail}` : ''}`);
        process.exitCode = 1;
    }
}
await main();
