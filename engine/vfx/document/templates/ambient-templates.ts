import { colorConstant, colorRandom, constantCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom } from '../vfx-curves';
import { createInitial, createRenderer, createShape, createSpawn, createVfxDocument, type VfxDocument } from '../vfx-document';
import { emitter, gradient, module, WHITE } from './template-helpers';
const SKY_BOX = { kind: 'box' as const, size: [10, 0.2, 10] as [
        number,
        number,
        number
    ], rotation: [180, 0, 0] as [
        number,
        number,
        number
    ] };
export function buildAshFall(): VfxDocument {
    const ash = emitter(7, {
        name: 'Cinzas',
        maxParticles: 500,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(60) }),
        shape: createShape({ ...SKY_BOX, offset: [0, 6, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(6, 9),
            speed: scalarRandom(0.5, 0.9),
            size: scalarRandom(0.02, 0.05),
            aspect: 0.8,
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-120, 120),
            color: colorRandom([0.5, 0.48, 0.46], [0.25, 0.24, 0.24]),
        }),
        modules: [
            module('noise', { strength: 0.7, frequency: 0.35, scrollSpeed: 0.2, octaves: 2, curve: constantCurve(1) }),
            module('force', { force: [0.3, 0, 0.1], randomize: 0.4, space: 'world' }),
            module('collision', { planeHeight: 0, bounce: 0, friction: 1, lifetimeLoss: 1, killOnCollide: true }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.9) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'square' }, lighting: 'lit' }),
    });
    const embers = emitter(0, {
        name: 'Brasas no ar',
        maxParticles: 40,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(6) }),
        shape: createShape({ ...SKY_BOX, offset: [0, 5, 0] }),
        initial: createInitial({ lifetime: scalarRandom(3, 5), speed: scalarRandom(0.3, 0.6), size: scalarRandom(0.015, 0.03), rotation: scalarConstant(0), color: colorRandom([1, 0.6, 0.2], [1, 0.4, 0.1]) }),
        modules: [
            module('noise', { strength: 1, frequency: 0.6, scrollSpeed: 0.4, octaves: 1, curve: constantCurve(1) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 0], [0.1, 1], [0.4, 0.3], [0.55, 1], [0.8, 0.4], [1, 0]]) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 6 }),
    });
    return createVfxDocument({ name: 'Cinzas', duration: 6, prewarm: 6, cullRadius: 12, emitters: [ash, embers] });
}
export function buildDustMotes(): VfxDocument {
    const motes = emitter(6, {
        name: 'Poeira',
        maxParticles: 240,
        spawn: createSpawn({ rate: scalarConstant(30) }),
        shape: createShape({ kind: 'box', size: [6, 3, 6], offset: [0, 1.5, 0] }),
        initial: createInitial({ lifetime: scalarRandom(5, 8), speed: scalarRandom(0.05, 0.15), size: scalarRandom(0.01, 0.025), rotation: scalarConstant(0), color: colorConstant([1, 0.95, 0.85], 0.6) }),
        modules: [
            module('noise', { strength: 0.25, frequency: 0.3, scrollSpeed: 0.15, octaves: 2, curve: constantCurve(1) }),
            module('limitVelocity', { speed: 0.2, dampen: 0.3 }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.6, 0.15, 0.8) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'bokeh' }, intensity: 1.2, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Poeira no ar', duration: 6, prewarm: 6, cullRadius: 8, emitters: [motes] });
}
export function buildPetals(): VfxDocument {
    const petals = emitter(3, {
        name: 'Pétalas',
        maxParticles: 160,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(12) }),
        shape: createShape({ kind: 'box', size: [1, 3, 8], offset: [-4, 2.5, 0], rotation: [0, 0, -90] }),
        initial: createInitial({
            lifetime: scalarRandom(5, 7),
            speed: scalarRandom(1, 2),
            size: scalarRandom(0.06, 0.1),
            aspect: 0.6,
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-200, 200),
            color: colorRandom([1, 0.72, 0.82], [1, 0.88, 0.93]),
        }),
        modules: [
            module('force', { force: [1.2, 0, 0.2], randomize: 0.5, space: 'world' }),
            module('noise', { strength: 1.5, frequency: 0.45, scrollSpeed: 0.5, octaves: 2, curve: constantCurve(1) }),
            module('gravity', { scale: 0.2 }),
            module('drag', { coefficient: 0.8, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0, friction: 1, lifetimeLoss: 0.3, killOnCollide: false }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.85) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'circle' }, lighting: 'lit', sort: 'distance' }),
    });
    return createVfxDocument({ name: 'Pétalas', duration: 6, prewarm: 4, cullRadius: 12, emitters: [petals] });
}
export function buildGroundFog(): VfxDocument {
    const fog = emitter(5, {
        name: 'Névoa',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(10) }),
        shape: createShape({ kind: 'box', size: [6, 0.3, 6], offset: [0, 0.15, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(5, 8),
            speed: scalarRandom(0.1, 0.25),
            size: scalarRandom(1.4, 2.2),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-6, 6),
            color: colorConstant([0.8, 0.85, 0.9], 1),
        }),
        modules: [
            module('force', { force: [0.3, 0, 0.1], randomize: 0.5, space: 'world' }),
            module('noise', { strength: 0.25, frequency: 0.25, scrollSpeed: 0.1, octaves: 2, curve: constantCurve(1) }),
            module('limitVelocity', { speed: 0.3, dampen: 0.2 }),
            module('sizeOverLife', { curve: linearCurve(0.8, 1.3) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.28, 0.2, 0.6) }),
        ],
        renderer: createRenderer({ mode: 'horizontal', blend: 'alpha', texture: { kind: 'builtin', id: 'noise' }, lighting: 'lit', softness: 1.5, sort: 'distance' }),
    });
    const clouds = emitter(1, {
        name: 'Nuvens baixas',
        maxParticles: 40,
        spawn: createSpawn({ rate: scalarConstant(5) }),
        shape: createShape({ kind: 'box', size: [6, 0.6, 6], offset: [0, 0.4, 0] }),
        initial: createInitial({ lifetime: scalarRandom(6, 9), speed: scalarRandom(0.1, 0.2), size: scalarRandom(1.6, 2.6), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-4, 4), color: colorConstant([0.85, 0.88, 0.92], 1) }),
        modules: [
            module('force', { force: [0.3, 0, 0.1], randomize: 0.5, space: 'world' }),
            module('noise', { strength: 0.2, frequency: 0.2, scrollSpeed: 0.1, octaves: 2, curve: constantCurve(1) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.18, 0.25, 0.6) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1.5, sort: 'distance' }),
    });
    return createVfxDocument({ name: 'Névoa rasteira', duration: 6, prewarm: 8, cullRadius: 10, emitters: [fog, clouds] });
}
