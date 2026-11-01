import { bellCurve, colorConstant, colorRandom, constantCurve, createCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom } from '../vfx-curves';
import { createInitial, createRenderer, createShape, createSpawn, createVfxDocument, type VfxDocument, type VfxEmitter } from '../vfx-document';
import { burstSpawn, emitter, FIRE_GRADIENT, gradient, module, WHITE } from './template-helpers';
const FORWARD: readonly [
    number,
    number,
    number
] = [90, 0, 0];
function emberSparks(index: number, name: string, patch: Partial<Omit<VfxEmitter, 'id'>>): VfxEmitter {
    return emitter(index, {
        name,
        maxParticles: 150,
        spawn: createSpawn({ rate: scalarConstant(18) }),
        shape: createShape({ kind: 'sphere', radius: 0.5, thickness: 1, spherizeDirection: 0.2 }),
        initial: createInitial({
            lifetime: scalarRandom(1, 2.2),
            speed: scalarRandom(0.8, 2),
            size: scalarRandom(0.02, 0.045),
            rotation: scalarConstant(0),
            color: colorRandom([1, 0.75, 0.3], [1, 0.45, 0.12]),
        }),
        modules: [
            module('gravity', { scale: -0.1 }),
            module('noise', { strength: 1.3, frequency: 1.6, scrollSpeed: 0.6, octaves: 1, curve: constantCurve(1) }),
            module('drag', { coefficient: 0.6, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 1 }, { t: 0.7, v: 0.8 }, { t: 1, v: 0 }]) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE], [1, [1, 0.5, 0.2]]], [[0, 1], [0.5, 1], [0.75, 0.3], [0.85, 1], [1, 0]]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.06, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 7 }),
        ...patch,
    });
}
export function buildCandle(): VfxDocument {
    const flame = emitter(0, {
        name: 'Chama',
        maxParticles: 60,
        spawn: createSpawn({ rate: scalarConstant(32) }),
        shape: createShape({ kind: 'cone', radius: 0.012, angle: 5, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(0.25, 0.4),
            speed: scalarRandom(0.35, 0.55),
            size: scalarRandom(0.05, 0.08),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-30, 30),
            color: colorConstant([1, 0.88, 0.6], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.6 }, { t: 0.3, v: 1 }, { t: 1, v: 0.1 }]) }),
            module('colorOverLife', { gradient: FIRE_GRADIENT }),
            module('noise', { strength: 0.12, frequency: 2.2, scrollSpeed: 1.4, octaves: 1, curve: linearCurve(0.2, 1) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 3.5, softness: 0.3 }),
    });
    const halo = emitter(1, {
        name: 'Halo',
        maxParticles: 6,
        spawn: createSpawn({ rate: scalarConstant(4) }),
        shape: createShape({ kind: 'point', offset: [0, 0.04, 0] }),
        initial: createInitial({ lifetime: scalarConstant(0.6), speed: scalarConstant(0), size: scalarRandom(0.22, 0.28), rotation: scalarConstant(0), color: colorConstant([1, 0.62, 0.25], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.3, 0.3, 0.6) }), module('sizeOverLife', { curve: bellCurve(0.85, 1, 0.5) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 1.4, softness: 0.6 }),
    });
    const wisp = emitter(2, {
        name: 'Fio de fumaça',
        maxParticles: 12,
        spawn: createSpawn({ rate: scalarConstant(3) }),
        shape: createShape({ kind: 'cone', radius: 0.004, angle: 4, offset: [0, 0.12, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(1.2, 2),
            speed: scalarRandom(0.25, 0.4),
            size: scalarRandom(0.04, 0.07),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-20, 20),
            color: colorConstant([0.35, 0.34, 0.33], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.6, 2) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.25, 0.15, 0.4) }),
            module('noise', { strength: 0.2, frequency: 1.5, scrollSpeed: 0.5, octaves: 1, curve: linearCurve(0, 1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 0.8 }),
    });
    return createVfxDocument({ name: 'Vela', duration: 2, prewarm: 1, emitters: [flame, halo, wisp] });
}
export function buildGroundFire(): VfxDocument {
    const flames = emitter(0, {
        name: 'Chamas',
        maxParticles: 500,
        spawn: createSpawn({ rate: scalarConstant(110) }),
        shape: createShape({ kind: 'circle', radius: 0.9, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(0.4, 0.8),
            speed: scalarRandom(1, 1.8),
            size: scalarRandom(0.35, 0.6),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-40, 40),
            color: colorConstant([1, 0.85, 0.55], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.5 }, { t: 0.3, v: 1 }, { t: 1, v: 0.15 }]) }),
            module('colorOverLife', { gradient: FIRE_GRADIENT }),
            module('velocityOverLife', { speedCurve: linearCurve(1, 0.4), linear: [0, 0, 0], space: 'local' }),
            module('noise', { strength: 0.9, frequency: 1.1, scrollSpeed: 0.8, octaves: 1, curve: linearCurve(0.3, 1) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 3, softness: 0.4 }),
    });
    const embers = emberSparks(1, 'Brasas', { spawn: createSpawn({ rate: scalarConstant(26) }), shape: createShape({ kind: 'circle', radius: 0.9, thickness: 1, spherizeDirection: 0.15 }) });
    const smoke = emitter(2, {
        name: 'Fumaça',
        maxParticles: 100,
        spawn: createSpawn({ rate: scalarConstant(10) }),
        shape: createShape({ kind: 'circle', radius: 0.7, thickness: 1, offset: [0, 0.5, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(2.5, 4),
            speed: scalarRandom(0.6, 1),
            size: scalarRandom(0.8, 1.3),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-15, 15),
            color: colorRandom([0.4, 0.38, 0.36], [0.2, 0.19, 0.18]),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.5, 2) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.4, 0.12, 0.45) }),
            module('noise', { strength: 0.35, frequency: 0.6, scrollSpeed: 0.3, octaves: 1, curve: constantCurve(1) }),
            module('force', { force: [0.4, 0, 0.1], randomize: 0.3, space: 'world' }),
            module('drag', { coefficient: 0.25, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1, sort: 'distance' }),
    });
    return createVfxDocument({ name: 'Fogo rasteiro', duration: 3, prewarm: 2, emitters: [flames, embers, smoke] });
}
export function buildFlamethrower(): VfxDocument {
    const jet = emitter(0, {
        name: 'Jato de fogo',
        maxParticles: 400,
        spawn: createSpawn({ rate: scalarConstant(220) }),
        shape: createShape({ kind: 'cone', radius: 0.05, angle: 7, thickness: 1, rotation: FORWARD }),
        initial: createInitial({
            lifetime: scalarRandom(0.35, 0.6),
            speed: scalarRandom(9, 12),
            size: scalarRandom(0.12, 0.2),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-120, 120),
            color: colorConstant([1, 0.9, 0.6], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.3 }, { t: 0.5, v: 1 }, { t: 1, v: 1.6 }]) }),
            module('colorOverLife', { gradient: gradient([[0, [1, 0.97, 0.8]], [0.3, [1, 0.6, 0.15]], [0.7, [0.8, 0.15, 0.02]], [1, [0.15, 0.02, 0]]], [[0, 0.9], [0.5, 0.8], [1, 0]]) }),
            module('drag', { coefficient: 1.8, curve: constantCurve(1) }),
            module('gravity', { scale: -0.3 }),
            module('noise', { strength: 0.6, frequency: 1.5, scrollSpeed: 1, octaves: 1, curve: linearCurve(0, 1) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 3.5, softness: 0.3 }),
    });
    const smoke = emitter(2, {
        name: 'Fumaça',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(24) }),
        shape: createShape({ kind: 'cone', radius: 0.1, angle: 10, rotation: FORWARD, offset: [0, 0, 2.5] }),
        initial: createInitial({
            lifetime: scalarRandom(1.2, 2),
            speed: scalarRandom(2, 3.5),
            size: scalarRandom(0.4, 0.7),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-40, 40),
            color: colorRandom([0.35, 0.33, 0.32], [0.18, 0.17, 0.17]),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.6, 2.2) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.35, 0.15, 0.4) }),
            module('gravity', { scale: -0.25 }),
            module('drag', { coefficient: 1.2, curve: constantCurve(1) }),
            module('noise', { strength: 0.4, frequency: 0.8, scrollSpeed: 0.4, octaves: 1, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1, sort: 'distance' }),
    });
    const sparks = emitter(1, {
        name: 'Faíscas',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(30) }),
        shape: createShape({ kind: 'cone', radius: 0.03, angle: 9, rotation: FORWARD }),
        initial: createInitial({ lifetime: scalarRandom(0.4, 0.9), speed: scalarRandom(10, 14), size: scalarRandom(0.015, 0.03), rotation: scalarConstant(0), color: colorRandom([1, 0.95, 0.7], [1, 0.6, 0.2]) }),
        modules: [module('gravity', { scale: 0.6 }), module('drag', { coefficient: 0.8, curve: constantCurve(1) }), module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [0.7, 1], [1, 0]]) })],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.05, stretchMinimum: 1.2, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 7 }),
    });
    return createVfxDocument({ name: 'Lança-chamas', duration: 1.5, prewarm: 0.8, emitters: [jet, sparks, smoke] });
}
export function buildFireballProjectile(): VfxDocument {
    const core = emitter(0, {
        name: 'Núcleo',
        maxParticles: 16,
        spawn: createSpawn({ rate: scalarConstant(40) }),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarRandom(0.12, 0.2), speed: scalarConstant(0), size: scalarRandom(0.45, 0.6), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-200, 200), color: colorConstant([1, 0.9, 0.65], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(1, 0.6) }), module('colorOverLife', { gradient: gradient([[0, WHITE], [1, [1, 0.55, 0.15]]], [[0, 1], [1, 0]]) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 5, softness: 0.3 }),
    });
    const trail = emitter(1, {
        name: 'Rastro',
        maxParticles: 160,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(70), rateOverDistance: 30 }),
        shape: createShape({ kind: 'sphere', radius: 0.12, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(0.4, 0.8),
            speed: scalarRandom(0.4, 0.9),
            size: scalarRandom(0.25, 0.4),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-90, 90),
            color: colorConstant([1, 0.8, 0.5], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.7 }, { t: 0.25, v: 1 }, { t: 1, v: 0.1 }]) }),
            module('colorOverLife', { gradient: FIRE_GRADIENT }),
            module('gravity', { scale: -0.35 }),
            module('noise', { strength: 0.5, frequency: 1.5, scrollSpeed: 1, octaves: 1, curve: linearCurve(0.2, 1) }),
            module('drag', { coefficient: 1, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 3.5, softness: 0.4 }),
    });
    const sparks = emberSparks(2, 'Fagulhas', {
        maxParticles: 60,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(25), rateOverDistance: 10 }),
        shape: createShape({ kind: 'sphere', radius: 0.15, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 1), speed: scalarRandom(1.2, 2.5), size: scalarRandom(0.02, 0.04), rotation: scalarConstant(0), color: colorRandom([1, 0.9, 0.5], [1, 0.55, 0.15]) }),
    });
    return createVfxDocument({ name: 'Bola de fogo', duration: 1, prewarm: 0.6, emitters: [core, trail, sparks] });
}
export function buildFireworks(): VfxDocument {
    const APEX: readonly [
        number,
        number,
        number
    ] = [0, 4.2, 0];
    const TWINKLE: ReadonlyArray<[
        number,
        number
    ]> = [[0, 1], [0.6, 1], [0.72, 0.25], [0.82, 1], [1, 0]];
    const launch = emitter(0, {
        name: 'Subida',
        maxParticles: 120,
        duration: 0.5,
        spawn: createSpawn({ rate: scalarConstant(160) }),
        shape: createShape({ kind: 'cone', radius: 0.02, angle: 2, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 0.7), speed: scalarRandom(7.5, 8.5), size: scalarRandom(0.03, 0.05), rotation: scalarConstant(0), color: colorConstant([1, 0.85, 0.6], 1) }),
        modules: [module('gravity', { scale: 0.5 }), module('sizeOverLife', { curve: linearCurve(1, 0) }), module('colorOverLife', { gradient: gradient([[0, WHITE], [1, [1, 0.6, 0.3]]], [[0, 1], [1, 0]]) })],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.06, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 6 }),
    });
    const burst = emitter(3, {
        name: 'Explosão',
        maxParticles: 400,
        spawn: burstSpawn(240, 320, 0, 0.6),
        shape: createShape({ kind: 'sphere', radius: 0.1, thickness: 1, offset: APEX }),
        initial: createInitial({
            lifetime: scalarRandom(1.1, 1.8),
            speed: scalarRandom(4.5, 7),
            size: scalarRandom(0.035, 0.06),
            rotation: scalarConstant(0),
            color: colorRandom([1, 0.4, 0.6], [0.4, 0.6, 1]),
        }),
        modules: [
            module('gravity', { scale: 0.45 }),
            module('drag', { coefficient: 1.3, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 1 }, { t: 0.7, v: 0.8 }, { t: 1, v: 0 }]) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE], [0.3, WHITE]], TWINKLE) }),
            module('noise', { strength: 0.3, frequency: 1, scrollSpeed: 0.5, octaves: 1, curve: linearCurve(0, 1) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.05, stretchMinimum: 1.2, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 7 }),
    });
    const glitter = emitter(6, {
        name: 'Purpurina',
        maxParticles: 160,
        spawn: burstSpawn(120, 0, 0, 0.65),
        shape: createShape({ kind: 'sphere', radius: 0.1, thickness: 1, offset: APEX }),
        initial: createInitial({ lifetime: scalarRandom(1.6, 2.4), speed: scalarRandom(2.5, 4), size: scalarRandom(0.02, 0.035), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.95, 0.8], 1) }),
        modules: [module('gravity', { scale: 0.3 }), module('drag', { coefficient: 1, curve: constantCurve(1) }), module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [0.4, 1], [0.5, 0.1], [0.6, 1], [0.75, 0.1], [0.85, 1], [1, 0]]) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'spark' }, intensity: 8 }),
    });
    const flash = emitter(1, {
        name: 'Clarão',
        maxParticles: 2,
        spawn: burstSpawn(1, 0, 0, 0.6),
        shape: createShape({ kind: 'point', offset: APEX }),
        initial: createInitial({ lifetime: scalarConstant(0.25), speed: scalarConstant(0), size: scalarConstant(3.5), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.9, 0.85], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.5, 1.6) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.3) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 6 }),
    });
    return createVfxDocument({ name: 'Fogos de artifício', duration: 2.4, cullRadius: 10, emitters: [launch, flash, burst, glitter] });
}
export function buildLava(): VfxDocument {
    const embers = emberSparks(0, 'Brasas', {
        spawn: createSpawn({ rate: scalarConstant(18) }),
        shape: createShape({ kind: 'circle', radius: 0.8, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(1, 2), speed: scalarRandom(1.2, 2.6), size: scalarRandom(0.03, 0.06), rotation: scalarConstant(0), color: colorRandom([1, 0.6, 0.15], [1, 0.3, 0.05]) }),
        modules: [
            module('gravity', { scale: 0.9 }),
            module('drag', { coefficient: 0.5, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0.2, friction: 0.6, lifetimeLoss: 0.5, killOnCollide: false }),
            module('colorOverLife', { gradient: gradient([[0, WHITE], [0.4, [1, 0.5, 0.15]], [1, [0.4, 0.05, 0]]], [[0, 1], [0.8, 1], [1, 0]]) }),
        ],
    });
    const bubbles = emitter(7, {
        name: 'Bolhas estourando',
        maxParticles: 12,
        spawn: createSpawn({ rate: scalarConstant(6) }),
        shape: createShape({ kind: 'circle', radius: 0.8, thickness: 1, offset: [0, 0.02, 0] }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 0.8), speed: scalarConstant(0), size: scalarRandom(0.15, 0.3), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.45, 0.1], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.4, 1.4) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.9, 0.1, 0.5) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'ring' }, intensity: 3, softness: 0.3 }),
    });
    const heat = emitter(1, {
        name: 'Calor',
        maxParticles: 24,
        spawn: createSpawn({ rate: scalarConstant(10) }),
        shape: createShape({ kind: 'circle', radius: 0.7, thickness: 1, offset: [0, 0.05, 0] }),
        initial: createInitial({ lifetime: scalarRandom(1.2, 2), speed: scalarRandom(0.3, 0.5), size: scalarRandom(0.5, 0.8), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.35, 0.08], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.6, 1.6) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.35, 0.2, 0.5) }), module('noise', { strength: 0.3, frequency: 0.8, scrollSpeed: 0.4, octaves: 1, curve: constantCurve(1) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 2, softness: 0.6 }),
    });
    const smoke = emitter(2, {
        name: 'Fumaça escura',
        maxParticles: 24,
        spawn: createSpawn({ rate: scalarConstant(5) }),
        shape: createShape({ kind: 'circle', radius: 0.6, thickness: 1, offset: [0, 0.3, 0] }),
        initial: createInitial({ lifetime: scalarRandom(2.5, 4), speed: scalarRandom(0.4, 0.7), size: scalarRandom(0.6, 1), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-12, 12), color: colorConstant([0.2, 0.18, 0.17], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.6, 2) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.45, 0.15, 0.45) }), module('noise', { strength: 0.3, frequency: 0.6, scrollSpeed: 0.3, octaves: 1, curve: constantCurve(1) })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1, sort: 'distance' }),
    });
    return createVfxDocument({ name: 'Lava', duration: 3, prewarm: 2, emitters: [embers, bubbles, heat, smoke] });
}
export function buildChimneySmoke(): VfxDocument {
    const smoke = emitter(5, {
        name: 'Fumaça',
        maxParticles: 100,
        spawn: createSpawn({ rate: scalarConstant(14) }),
        shape: createShape({ kind: 'cone', radius: 0.12, angle: 6, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(4, 6),
            speed: scalarRandom(1.2, 1.8),
            size: scalarRandom(0.35, 0.5),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-12, 12),
            color: colorRandom([0.75, 0.75, 0.76], [0.55, 0.55, 0.58]),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.5, 3.2) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.55, 0.08, 0.4) }),
            module('velocityOverLife', { speedCurve: linearCurve(1, 0.3), linear: [0, 0, 0], space: 'local' }),
            module('force', { force: [0.9, 0, 0.2], randomize: 0.3, space: 'world' }),
            module('noise', { strength: 0.4, frequency: 0.4, scrollSpeed: 0.25, octaves: 2, curve: constantCurve(1) }),
            module('drag', { coefficient: 0.2, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1.2, sort: 'distance' }),
    });
    const soot = emitter(7, {
        name: 'Fuligem',
        maxParticles: 16,
        spawn: createSpawn({ rate: scalarConstant(3) }),
        shape: createShape({ kind: 'cone', radius: 0.1, angle: 8, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(2, 3.5), speed: scalarRandom(1, 1.5), size: scalarRandom(0.02, 0.04), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-180, 180), color: colorConstant([0.12, 0.11, 0.11], 1) }),
        modules: [module('gravity', { scale: 0.15 }), module('noise', { strength: 0.5, frequency: 0.6, scrollSpeed: 0.3, octaves: 1, curve: constantCurve(1) }), module('force', { force: [0.9, 0, 0.2], randomize: 0.3, space: 'world' }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.8) })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'square' }, lighting: 'lit' }),
    });
    return createVfxDocument({ name: 'Fumaça de chaminé', duration: 5, prewarm: 5, cullRadius: 10, emitters: [smoke, soot] });
}
