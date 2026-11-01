import { colorConstant, colorRandom, constantCurve, createCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom } from '../vfx-curves';
import { createInitial, createRenderer, createShape, createSpawn, createVfxDocument, type VfxDocument } from '../vfx-document';
import { burstSpawn, emitter, gradient, module, WHITE } from './template-helpers';
const FORWARD: readonly [
    number,
    number,
    number
] = [90, 0, 0];
export function buildMuzzleFlash(): VfxDocument {
    const INTERVAL = 0.9;
    const flash = emitter(6, {
        name: 'Clarão',
        maxParticles: 2,
        spawn: burstSpawn(1, 0, INTERVAL),
        shape: createShape({ kind: 'point', offset: [0, 0, 0.1] }),
        initial: createInitial({ lifetime: scalarConstant(0.07), speed: scalarConstant(0), size: scalarConstant(0.7), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.85, 0.5], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.7, 1.3) }), module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [1, 0]]) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 10 }),
    });
    const flame = emitter(0, {
        name: 'Chama',
        maxParticles: 30,
        spawn: burstSpawn(14, 20, INTERVAL),
        shape: createShape({ kind: 'cone', radius: 0.03, angle: 14, thickness: 1, rotation: FORWARD }),
        initial: createInitial({ lifetime: scalarRandom(0.08, 0.14), speed: scalarRandom(6, 10), size: scalarRandom(0.1, 0.18), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.8, 0.45], 1) }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.5, 1.4) }),
            module('colorOverLife', { gradient: gradient([[0, [1, 0.95, 0.8]], [0.5, [1, 0.55, 0.15]], [1, [0.5, 0.1, 0.02]]], [[0, 1], [1, 0]]) }),
            module('drag', { coefficient: 2, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.04, stretchMinimum: 1.2, blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 6, softness: 0.3 }),
    });
    const smoke = emitter(5, {
        name: 'Fumaça',
        maxParticles: 24,
        spawn: burstSpawn(8, 12, INTERVAL, 0.02),
        shape: createShape({ kind: 'cone', radius: 0.03, angle: 16, thickness: 1, rotation: FORWARD }),
        initial: createInitial({ lifetime: scalarRandom(0.6, 1.1), speed: scalarRandom(1.5, 3), size: scalarRandom(0.12, 0.22), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-60, 60), color: colorConstant([0.65, 0.65, 0.65], 1) }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.6, 2.2) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.45, 0.1, 0.4) }),
            module('drag', { coefficient: 2.2, curve: constantCurve(1) }),
            module('gravity', { scale: -0.15 }),
            module('noise', { strength: 0.4, frequency: 1, scrollSpeed: 0.5, octaves: 1, curve: linearCurve(0, 1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 0.8, sort: 'distance' }),
    });
    const casing = emitter(7, {
        name: 'Cartucho',
        maxParticles: 4,
        spawn: burstSpawn(1, 0, INTERVAL, 0.03),
        shape: createShape({ kind: 'cone', radius: 0.01, angle: 10, thickness: 1, rotation: [0, 0, -70], offset: [0.05, 0, 0] }),
        initial: createInitial({ lifetime: scalarConstant(1.2), speed: scalarRandom(2, 3), size: scalarConstant(0.03), aspect: 0.4, rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-900, 900), color: colorConstant([0.85, 0.7, 0.3], 1) }),
        modules: [module('gravity', { scale: 1.2 }), module('collision', { planeHeight: 0, bounce: 0.35, friction: 0.6, lifetimeLoss: 0.3, killOnCollide: false })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'square' }, lighting: 'lit' }),
    });
    return createVfxDocument({ name: 'Disparo', duration: INTERVAL, emitters: [flash, flame, smoke, casing] });
}
export function buildElectricity(): VfxDocument {
    const arcs = emitter(1, {
        name: 'Arcos',
        maxParticles: 120,
        spawn: createSpawn({ rate: scalarConstant(90) }),
        shape: createShape({ kind: 'sphere', radius: 0.25, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.12, 0.25), speed: scalarRandom(2, 5), size: scalarRandom(0.03, 0.06), rotation: scalarConstant(0), color: colorRandom([0.7, 0.85, 1], [0.9, 0.95, 1]) }),
        modules: [
            module('noise', { strength: 4, frequency: 3, scrollSpeed: 3, octaves: 2, curve: constantCurve(1) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [0.5, 0.3], [0.6, 1], [1, 0]]) }),
            module('sizeOverLife', { curve: linearCurve(1, 0.3) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.15, stretchMinimum: 2, blend: 'additive', texture: { kind: 'builtin', id: 'spark' }, intensity: 9 }),
    });
    const sparks = emitter(5, {
        name: 'Faíscas',
        maxParticles: 60,
        spawn: createSpawn({ rate: scalarConstant(25) }),
        shape: createShape({ kind: 'sphere', radius: 0.2, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.3, 0.7), speed: scalarRandom(1.5, 3.5), size: scalarRandom(0.015, 0.03), rotation: scalarConstant(0), color: colorConstant([0.8, 0.9, 1], 1) }),
        modules: [
            module('gravity', { scale: 0.8 }),
            module('drag', { coefficient: 1, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0.3, friction: 0.5, lifetimeLoss: 0.4, killOnCollide: false }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [0.7, 1], [1, 0]]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.06, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 8 }),
    });
    const core = emitter(4, {
        name: 'Núcleo',
        maxParticles: 6,
        spawn: createSpawn({ rate: scalarConstant(16) }),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarRandom(0.06, 0.1), speed: scalarConstant(0), size: scalarRandom(0.4, 0.6), rotation: scalarRandom(0, 360), color: colorConstant([0.75, 0.88, 1], 1) }),
        modules: [module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 0.9], [1, 0]]) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'flare' }, intensity: 6 }),
    });
    return createVfxDocument({ name: 'Eletricidade', duration: 1, prewarm: 0.5, emitters: [arcs, sparks, core] });
}
export function buildHit(): VfxDocument {
    const INTERVAL = 1.2;
    const flash = emitter(6, {
        name: 'Clarão',
        maxParticles: 2,
        spawn: burstSpawn(1, 0, INTERVAL),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(0.15), speed: scalarConstant(0), size: scalarConstant(0.9), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.95, 0.8], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.5, 1.3) }), module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [1, 0]]) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 8 }),
    });
    const shards = emitter(0, {
        name: 'Estilhaços de luz',
        maxParticles: 40,
        spawn: burstSpawn(18, 26, INTERVAL),
        shape: createShape({ kind: 'sphere', radius: 0.08, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.25, 0.45), speed: scalarRandom(4, 7), size: scalarRandom(0.05, 0.1), aspect: 0.5, rotation: scalarConstant(0), color: colorConstant([1, 0.9, 0.6], 1) }),
        modules: [
            module('drag', { coefficient: 3, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: linearCurve(1, 0) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [1, 0]]) }),
            module('rotationOverLife', { curve: constantCurve(0), alignToVelocity: true }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.08, stretchMinimum: 1.5, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 6 }),
    });
    const ring = emitter(7, {
        name: 'Anel',
        maxParticles: 2,
        spawn: burstSpawn(1, 0, INTERVAL),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(0.3), speed: scalarConstant(0), size: scalarConstant(0.3), rotation: scalarConstant(0), color: colorConstant([1, 0.9, 0.7], 1) }),
        modules: [module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.3 }, { t: 1, v: 2.5 }], 'linear') }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.9, 0.02, 0.2) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'ring' }, intensity: 4, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Golpe', duration: INTERVAL, emitters: [flash, shards, ring] });
}
