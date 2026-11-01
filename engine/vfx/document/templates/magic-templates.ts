import { bellCurve, colorConstant, colorRandom, constantCurve, createCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom } from '../vfx-curves';
import { createInitial, createRenderer, createShape, createSpawn, createVfxDocument, type VfxDocument } from '../vfx-document';
import { burstSpawn, emitter, gradient, module, WHITE } from './template-helpers';
export function buildFrost(): VfxDocument {
    const crystals = emitter(1, {
        name: 'Cristais',
        maxParticles: 60,
        spawn: createSpawn({ rate: scalarConstant(16) }),
        shape: createShape({ kind: 'circle', radius: 0.5, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(1.5, 2.5),
            speed: scalarRandom(0.3, 0.7),
            size: scalarRandom(0.06, 0.14),
            aspect: 0.5,
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-60, 60),
            color: colorRandom([0.75, 0.92, 1], [0.9, 0.98, 1]),
        }),
        modules: [
            module('gravity', { scale: -0.08 }),
            module('noise', { strength: 0.2, frequency: 1, scrollSpeed: 0.4, octaves: 1, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: bellCurve(0, 1, 0.4) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.15, 0.65) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'shard' }, intensity: 2.2 }),
    });
    const sparkles = emitter(5, {
        name: 'Brilhos',
        maxParticles: 24,
        spawn: createSpawn({ rate: scalarConstant(10) }),
        shape: createShape({ kind: 'sphere', radius: 0.6, thickness: 1, offset: [0, 0.6, 0] }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 1), speed: scalarConstant(0), size: scalarRandom(0.06, 0.14), rotation: scalarRandom(0, 360), color: colorConstant([0.85, 0.97, 1], 1) }),
        modules: [module('sizeOverLife', { curve: bellCurve(0, 1, 0.5) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.2, 0.6) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 5 }),
    });
    const mist = emitter(2, {
        name: 'Névoa fria',
        maxParticles: 16,
        spawn: createSpawn({ rate: scalarConstant(6) }),
        shape: createShape({ kind: 'circle', radius: 0.6, thickness: 1, offset: [0, 0.05, 0] }),
        initial: createInitial({ lifetime: scalarRandom(1.6, 2.4), speed: scalarRandom(0.1, 0.2), size: scalarRandom(0.6, 1), rotation: scalarRandom(0, 360), color: colorConstant([0.75, 0.9, 1], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.8, 1.4) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.3, 0.2, 0.6) }), module('noise', { strength: 0.2, frequency: 0.6, scrollSpeed: 0.2, octaves: 1, curve: constantCurve(1) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 1.2, softness: 0.6 }),
    });
    const ring = emitter(0, {
        name: 'Anel de gelo',
        maxParticles: 4,
        spawn: createSpawn({ rate: scalarConstant(1.5) }),
        shape: createShape({ kind: 'point', offset: [0, 0.03, 0] }),
        initial: createInitial({ lifetime: scalarConstant(2), speed: scalarConstant(0), size: scalarConstant(1.4), rotation: scalarRandom(0, 360), angularVelocity: scalarConstant(10), color: colorConstant([0.6, 0.85, 1], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.5, 0.2, 0.6) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'ring' }, intensity: 2, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Gelo', duration: 3, prewarm: 3, emitters: [crystals, sparkles, mist, ring] });
}
export function buildPoisonCloud(): VfxDocument {
    const cloud = emitter(2, {
        name: 'Névoa tóxica',
        maxParticles: 48,
        spawn: createSpawn({ rate: scalarConstant(12) }),
        shape: createShape({ kind: 'sphere', radius: 0.5, thickness: 1, offset: [0, 0.4, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(2, 3.5),
            speed: scalarRandom(0.2, 0.4),
            size: scalarRandom(0.5, 0.9),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-20, 20),
            color: colorRandom([0.35, 0.8, 0.25], [0.2, 0.55, 0.15]),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.6, 1.8) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.6, 0.15, 0.5) }),
            module('noise', { strength: 0.4, frequency: 0.7, scrollSpeed: 0.3, octaves: 1, curve: constantCurve(1) }),
            module('gravity', { scale: -0.05 }),
            module('drag', { coefficient: 0.6, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1, sort: 'distance' }),
    });
    const bubbles = emitter(5, {
        name: 'Bolhas',
        maxParticles: 16,
        spawn: createSpawn({ rate: scalarConstant(8) }),
        shape: createShape({ kind: 'circle', radius: 0.45, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.9, 1.5), speed: scalarRandom(0.4, 0.8), size: scalarRandom(0.04, 0.1), rotation: scalarConstant(0), color: colorConstant([0.6, 1, 0.4], 0.9) }),
        modules: [
            module('noise', { strength: 0.3, frequency: 1, scrollSpeed: 0.5, octaves: 1, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: linearCurve(0.6, 1.1) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 0], [0.1, 0.9], [0.85, 0.9], [1, 0]]) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'bokeh' }, intensity: 2.5 }),
    });
    const glow = emitter(6, {
        name: 'Brilho no chão',
        maxParticles: 6,
        spawn: createSpawn({ rate: scalarConstant(2) }),
        shape: createShape({ kind: 'point', offset: [0, 0.05, 0] }),
        initial: createInitial({ lifetime: scalarConstant(2), speed: scalarConstant(0), size: scalarConstant(1.6), rotation: scalarConstant(0), color: colorConstant([0.4, 0.9, 0.3], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.35, 0.3, 0.6) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 1.5, softness: 0.5 }),
    });
    return createVfxDocument({ name: 'Veneno', duration: 3, prewarm: 3, emitters: [cloud, bubbles, glow] });
}
export function buildLevelUp(): VfxDocument {
    const column = emitter(6, {
        name: 'Coluna de luz',
        maxParticles: 300,
        duration: 0.7,
        spawn: createSpawn({ rate: scalarConstant(220) }),
        shape: createShape({ kind: 'circle', radius: 0.45, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.8, 1.2), speed: scalarRandom(3, 4.5), size: scalarRandom(0.05, 0.1), rotation: scalarConstant(0), color: colorRandom([1, 0.9, 0.4], [1, 0.75, 0.2]) }),
        modules: [
            module('velocityOverLife', { speedCurve: linearCurve(1, 0.3), linear: [0, 0, 0], space: 'local' }),
            module('sizeOverLife', { curve: bellCurve(0, 1, 0.3) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.1, 0.6) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.08, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 6 }),
    });
    const stars = emitter(0, {
        name: 'Estrelas',
        maxParticles: 60,
        delay: 0.1,
        duration: 0.6,
        spawn: createSpawn({ rate: scalarConstant(40) }),
        shape: createShape({ kind: 'circle', radius: 0.5, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(1, 1.6), speed: scalarRandom(1.5, 2.5), size: scalarRandom(0.1, 0.2), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-120, 120), color: colorConstant([1, 0.95, 0.7], 1) }),
        modules: [module('sizeOverLife', { curve: bellCurve(0, 1, 0.3) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.1, 0.6) }), module('gravity', { scale: -0.15 })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 6 }),
    });
    const ring = emitter(7, {
        name: 'Anel',
        maxParticles: 2,
        spawn: burstSpawn(1),
        shape: createShape({ kind: 'point', offset: [0, 0.03, 0] }),
        initial: createInitial({ lifetime: scalarConstant(0.7), speed: scalarConstant(0), size: scalarConstant(0.5), rotation: scalarConstant(0), color: colorConstant([1, 0.85, 0.4], 1) }),
        modules: [module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.4 }, { t: 1, v: 5 }], 'linear') }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.9, 0.02, 0.3) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'ring' }, intensity: 3, softness: 0.3 }),
    });
    const flash = emitter(1, {
        name: 'Clarão',
        maxParticles: 2,
        spawn: burstSpawn(1, 0, 0, 0.05),
        shape: createShape({ kind: 'point', offset: [0, 1, 0] }),
        initial: createInitial({ lifetime: scalarConstant(0.4), speed: scalarConstant(0), size: scalarConstant(2.4), rotation: scalarConstant(0), color: colorConstant([1, 0.95, 0.8], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.5, 1.4) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.3) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'flare' }, intensity: 5 }),
    });
    return createVfxDocument({ name: 'Subida de nível', duration: 2.4, emitters: [column, stars, ring, flash] });
}
