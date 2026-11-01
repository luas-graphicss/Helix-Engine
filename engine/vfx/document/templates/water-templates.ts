import { colorConstant, constantCurve, createCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom } from '../vfx-curves';
import { createInitial, createRenderer, createShape, createSpawn, createVfxDocument, type VfxDocument } from '../vfx-document';
import { burstSpawn, emitter, gradient, module, WHITE } from './template-helpers';
const WATER: [
    number,
    number,
    number
] = [0.78, 0.9, 1];
export function buildFountain(): VfxDocument {
    const jet = emitter(1, {
        name: 'Jato',
        maxParticles: 500,
        spawn: createSpawn({ rate: scalarConstant(260) }),
        shape: createShape({ kind: 'cone', radius: 0.05, angle: 9, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(1.1, 1.4), speed: scalarRandom(5.5, 6.5), size: scalarRandom(0.04, 0.07), rotation: scalarConstant(0), color: colorConstant(WATER, 0.85) }),
        modules: [
            module('gravity', { scale: 1 }),
            module('collision', { planeHeight: 0, bounce: 0, friction: 1, lifetimeLoss: 1, killOnCollide: true }),
            module('sizeOverLife', { curve: linearCurve(1, 1.3) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 0.9], [0.8, 0.8], [1, 0]]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.05, stretchMinimum: 1.5, blend: 'alpha', texture: { kind: 'builtin', id: 'drop' }, intensity: 1.3 }),
    });
    const mist = emitter(5, {
        name: 'Névoa',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(40) }),
        shape: createShape({ kind: 'cone', radius: 0.15, angle: 20, thickness: 1, offset: [0, 0.6, 0] }),
        initial: createInitial({ lifetime: scalarRandom(0.8, 1.4), speed: scalarRandom(1.5, 2.5), size: scalarRandom(0.15, 0.3), rotation: scalarRandom(0, 360), color: colorConstant([0.88, 0.94, 1], 1) }),
        modules: [
            module('gravity', { scale: 0.3 }),
            module('drag', { coefficient: 1.5, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: linearCurve(0.6, 1.6) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.25, 0.1, 0.5) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'soft' }, softness: 0.8, sort: 'distance' }),
    });
    const splashes = emitter(0, {
        name: 'Respingos',
        maxParticles: 120,
        spawn: createSpawn({ rate: scalarConstant(60) }),
        shape: createShape({ kind: 'circle', radius: 0.9, thickness: 0.4, offset: [0, 0.02, 0] }),
        initial: createInitial({ lifetime: scalarRandom(0.3, 0.5), speed: scalarConstant(0), size: scalarRandom(0.08, 0.14), rotation: scalarConstant(0), color: colorConstant([0.85, 0.93, 1], 0.6) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.3, 1.3) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.7, 0.1, 0.3) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'alpha', texture: { kind: 'builtin', id: 'ring' }, softness: 0.2 }),
    });
    return createVfxDocument({ name: 'Chafariz', duration: 3, prewarm: 2, emitters: [jet, mist, splashes] });
}
export function buildWaterSplash(): VfxDocument {
    const INTERVAL = 1.5;
    const drops = emitter(1, {
        name: 'Gotas',
        maxParticles: 160,
        spawn: burstSpawn(70, 100, INTERVAL),
        shape: createShape({ kind: 'hemisphere', radius: 0.12, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 0.9), speed: scalarRandom(3, 5.5), size: scalarRandom(0.03, 0.06), rotation: scalarConstant(0), color: colorConstant(WATER, 0.85) }),
        modules: [
            module('gravity', { scale: 1 }),
            module('drag', { coefficient: 0.4, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0, friction: 1, lifetimeLoss: 1, killOnCollide: true }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [0.7, 0.9], [1, 0]]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.06, stretchMinimum: 1.2, blend: 'alpha', texture: { kind: 'builtin', id: 'drop' }, intensity: 1.3 }),
    });
    const crown = emitter(5, {
        name: 'Coroa',
        maxParticles: 60,
        spawn: burstSpawn(36, 0, INTERVAL),
        shape: createShape({ kind: 'circle', radius: 0.2, thickness: 0.1, emitFrom: 'edge', spherizeDirection: 0.6 }),
        initial: createInitial({ lifetime: scalarRandom(0.35, 0.5), speed: scalarRandom(2, 3), size: scalarRandom(0.06, 0.1), rotation: scalarConstant(0), color: colorConstant([0.85, 0.92, 1], 0.8) }),
        modules: [module('gravity', { scale: 1 }), module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [0.6, 0.8], [1, 0]]) })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'soft' }, softness: 0.7 }),
    });
    const ring = emitter(0, {
        name: 'Onda',
        maxParticles: 2,
        spawn: burstSpawn(1, 0, INTERVAL),
        shape: createShape({ kind: 'point', offset: [0, 0.01, 0] }),
        initial: createInitial({ lifetime: scalarConstant(0.6), speed: scalarConstant(0), size: scalarConstant(0.5), rotation: scalarConstant(0), color: colorConstant([0.85, 0.93, 1], 1) }),
        modules: [module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.3 }, { t: 1, v: 3 }], 'linear') }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.7, 0.02, 0.3) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'alpha', texture: { kind: 'builtin', id: 'ring' }, softness: 0.2 }),
    });
    const mist = emitter(2, {
        name: 'Névoa fina',
        maxParticles: 40,
        spawn: burstSpawn(20, 0, INTERVAL),
        shape: createShape({ kind: 'hemisphere', radius: 0.15, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.6, 1), speed: scalarRandom(1, 2), size: scalarRandom(0.2, 0.35), rotation: scalarRandom(0, 360), color: colorConstant(WHITE, 1) }),
        modules: [module('drag', { coefficient: 2, curve: constantCurve(1) }), module('gravity', { scale: 0.2 }), module('sizeOverLife', { curve: linearCurve(0.5, 1.6) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.25, 0.1, 0.4) })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'soft' }, softness: 0.8 }),
    });
    return createVfxDocument({ name: 'Respingo', duration: INTERVAL, emitters: [drops, crown, ring, mist] });
}
export function buildBubbles(): VfxDocument {
    const bubbles = emitter(1, {
        name: 'Bolhas',
        maxParticles: 60,
        spawn: createSpawn({ rate: scalarConstant(14) }),
        shape: createShape({ kind: 'circle', radius: 0.4, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(2.2, 3.5), speed: scalarRandom(0.5, 0.9), size: scalarRandom(0.04, 0.12), rotation: scalarConstant(0), color: colorConstant([0.85, 0.95, 1], 0.75) }),
        modules: [
            module('noise', { strength: 0.35, frequency: 1, scrollSpeed: 0.6, octaves: 1, curve: constantCurve(1) }),
            module('velocityOverLife', { speedCurve: linearCurve(1, 1.4), linear: [0, 0, 0], space: 'local' }),
            module('sizeOverLife', { curve: linearCurve(0.7, 1.2) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 0], [0.08, 0.8], [0.9, 0.8], [1, 0]]) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'bokeh' }, intensity: 1.1, softness: 0.1 }),
    });
    const tiny = emitter(5, {
        name: 'Bolhinhas',
        maxParticles: 100,
        spawn: createSpawn({ rate: scalarConstant(30) }),
        shape: createShape({ kind: 'circle', radius: 0.3, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(1.5, 2.5), speed: scalarRandom(0.7, 1.1), size: scalarRandom(0.015, 0.03), rotation: scalarConstant(0), color: colorConstant(WHITE, 0.6) }),
        modules: [module('noise', { strength: 0.5, frequency: 1.4, scrollSpeed: 0.8, octaves: 1, curve: constantCurve(1) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.6, 0.1, 0.85) })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'circle' }, softness: 0.2 }),
    });
    return createVfxDocument({ name: 'Bolhas', duration: 3, prewarm: 3, emitters: [bubbles, tiny] });
}
export function buildSteam(): VfxDocument {
    const steam = emitter(5, {
        name: 'Vapor',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(28) }),
        shape: createShape({ kind: 'cone', radius: 0.08, angle: 14, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(1, 1.8),
            speed: scalarRandom(1.6, 2.4),
            size: scalarRandom(0.2, 0.35),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-25, 25),
            color: colorConstant([0.95, 0.96, 1], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.5, 2.4) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.5, 0.1, 0.35) }),
            module('velocityOverLife', { speedCurve: linearCurve(1, 0.3), linear: [0, 0, 0], space: 'local' }),
            module('noise', { strength: 0.5, frequency: 1, scrollSpeed: 0.7, octaves: 1, curve: linearCurve(0.2, 1) }),
            module('gravity', { scale: -0.2 }),
            module('drag', { coefficient: 0.6, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1, sort: 'distance' }),
    });
    const droplets = emitter(1, {
        name: 'Gotículas',
        maxParticles: 20,
        spawn: createSpawn({ rate: scalarConstant(10) }),
        shape: createShape({ kind: 'cone', radius: 0.06, angle: 12, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.4, 0.7), speed: scalarRandom(2, 3), size: scalarRandom(0.015, 0.03), rotation: scalarConstant(0), color: colorConstant(WHITE, 0.7) }),
        modules: [module('gravity', { scale: 0.6 }), module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 1], [1, 0]]) })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'soft' } }),
    });
    return createVfxDocument({ name: 'Vapor', duration: 2, prewarm: 1.5, emitters: [steam, droplets] });
}
