import { bellCurve, colorConstant, colorRandom, constantCurve, createCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom, type VfxRgb } from './vfx-curves';
import { createBurst, createInitial, createRenderer, createShape, createSpawn, createVfxDocument, type VfxDocument, type VfxEmitter } from './vfx-document';
import { buildAshFall, buildDustMotes, buildGroundFog, buildPetals } from './templates/ambient-templates';
import { buildCandle, buildChimneySmoke, buildFireballProjectile, buildFireworks, buildFlamethrower, buildGroundFire, buildLava } from './templates/fire-templates';
import { buildElectricity, buildHit, buildMuzzleFlash } from './templates/impact-templates';
import { buildFrost, buildLevelUp, buildPoisonCloud } from './templates/magic-templates';
import { emitter, gradient, module, WHITE } from './templates/template-helpers';
import { buildBubbles, buildFountain, buildSteam, buildWaterSplash } from './templates/water-templates';
export type VfxTemplateCategory = 'basic' | 'fire' | 'water' | 'weather' | 'magic' | 'impact';
export interface VfxTemplate {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly category: VfxTemplateCategory;
    readonly build: () => VfxDocument;
}
export const VFX_TEMPLATE_CATEGORIES: readonly VfxTemplateCategory[] = ['basic', 'fire', 'impact', 'water', 'weather', 'magic'];
export const VFX_TEMPLATE_CATEGORY_LABEL: Record<VfxTemplateCategory, string> = {
    basic: 'Começar',
    fire: 'Fogo e fumaça',
    water: 'Água e vapor',
    weather: 'Clima e ambiente',
    magic: 'Magia',
    impact: 'Impactos',
};
function flames(index: number, radius: number, height: number, intensity: number): VfxEmitter {
    return emitter(index, {
        name: 'Chamas',
        maxParticles: 300,
        spawn: createSpawn({ rate: scalarConstant(42) }),
        shape: createShape({ kind: 'cone', radius, angle: 12, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(0.5, 0.9),
            speed: scalarRandom(height * 1.4, height * 2.2),
            size: scalarRandom(radius * 1.4, radius * 2.2),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-40, 40),
            color: colorConstant([1, 0.85, 0.55], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.5 }, { t: 0.3, v: 1 }, { t: 1, v: 0.15 }]) }),
            module('colorOverLife', { gradient: gradient([[0, [1, 0.95, 0.75]], [0.35, [1, 0.55, 0.12]], [0.75, [0.75, 0.12, 0.02]], [1, [0.2, 0.02, 0]]], [[0, 0], [0.12, 1], [0.6, 0.8], [1, 0]]) }),
            module('velocityOverLife', { speedCurve: linearCurve(1, 0.35), linear: [0, 0, 0], space: 'local' }),
            module('noise', { strength: 0.7, frequency: 1.2, scrollSpeed: 0.8, octaves: 1, curve: linearCurve(0.3, 1) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity, softness: 0.35 }),
    });
}
function embers(index: number, radius: number): VfxEmitter {
    return emitter(index, {
        name: 'Brasas',
        maxParticles: 120,
        spawn: createSpawn({ rate: scalarConstant(14) }),
        shape: createShape({ kind: 'sphere', radius: radius * 0.8, thickness: 1, spherizeDirection: 0.2 }),
        initial: createInitial({
            lifetime: scalarRandom(1.2, 2.6),
            speed: scalarRandom(0.8, 2.2),
            size: scalarRandom(0.025, 0.05),
            rotation: scalarConstant(0),
            color: colorRandom([1, 0.75, 0.3], [1, 0.45, 0.12]),
        }),
        modules: [
            module('gravity', { scale: -0.12 }),
            module('noise', { strength: 1.4, frequency: 1.6, scrollSpeed: 0.6, octaves: 1, curve: constantCurve(1) }),
            module('drag', { coefficient: 0.6, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 1 }, { t: 0.7, v: 0.8 }, { t: 1, v: 0 }]) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE], [1, [1, 0.5, 0.2]]], [[0, 1], [0.5, 1], [0.75, 0.3], [0.85, 1], [1, 0]]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.06, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 7 }),
    });
}
function smoke(index: number, radius: number, offsetY: number, rate: number, alpha: number): VfxEmitter {
    return emitter(index, {
        name: 'Fumaça',
        maxParticles: 120,
        spawn: createSpawn({ rate: scalarConstant(rate) }),
        shape: createShape({ kind: 'cone', radius, angle: 8, offset: [0, offsetY, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(2.4, 4),
            speed: scalarRandom(0.5, 0.9),
            size: scalarRandom(radius * 2.4, radius * 3.6),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-15, 15),
            color: colorRandom([0.42, 0.4, 0.38], [0.22, 0.2, 0.2]),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(0.55, 1.8) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, alpha, 0.12, 0.45) }),
            module('noise', { strength: 0.35, frequency: 0.6, scrollSpeed: 0.3, octaves: 1, curve: constantCurve(1) }),
            module('force', { force: [0.35, 0, 0.1], randomize: 0.3, space: 'world' }),
            module('drag', { coefficient: 0.25, curve: constantCurve(1) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1, sort: 'distance' }),
    });
}
function buildCampfire(): VfxDocument {
    return createVfxDocument({ name: 'Fogueira', duration: 3, prewarm: 2, emitters: [flames(0, 0.22, 1, 3), embers(1, 0.22), smoke(2, 0.18, 0.7, 5, 0.32)] });
}
function buildTorch(): VfxDocument {
    const flame = { ...flames(0, 0.08, 0.55, 4), name: 'Chama' };
    const glow = emitter(1, {
        name: 'Halo',
        maxParticles: 8,
        spawn: createSpawn({ rate: scalarConstant(3) }),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(1), speed: scalarConstant(0), size: scalarRandom(0.9, 1.1), rotation: scalarConstant(0), color: colorConstant([1, 0.6, 0.25], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.35, 0.3, 0.6) }), module('sizeOverLife', { curve: bellCurve(0.8, 1, 0.5) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 1.6, softness: 0.6 }),
    });
    return createVfxDocument({ name: 'Tocha', duration: 2, prewarm: 1.5, emitters: [flame, { ...embers(2, 0.08), spawn: createSpawn({ rate: scalarConstant(6) }) }, glow] });
}
function buildThruster(): VfxDocument {
    const jet = emitter(0, {
        name: 'Jato',
        maxParticles: 400,
        spawn: createSpawn({ rate: scalarConstant(160) }),
        shape: createShape({ kind: 'cone', radius: 0.14, angle: 4, rotation: [180, 0, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(0.18, 0.3),
            speed: scalarRandom(9, 12),
            size: scalarRandom(0.16, 0.24),
            rotation: scalarConstant(0),
            color: colorConstant([0.6, 0.85, 1], 1),
        }),
        modules: [
            module('sizeOverLife', { curve: linearCurve(1, 0.2) }),
            module('colorOverLife', { gradient: gradient([[0, WHITE], [0.3, [0.5, 0.8, 1]], [1, [0.2, 0.3, 1]]], [[0, 1], [0.7, 0.8], [1, 0]]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.05, stretchMinimum: 1.5, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 6 }),
    });
    const core = emitter(1, {
        name: 'Núcleo',
        maxParticles: 10,
        spawn: createSpawn({ rate: scalarConstant(20) }),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(0.12), speed: scalarConstant(0), size: scalarRandom(0.5, 0.65), rotation: scalarRandom(0, 360), color: colorConstant([0.85, 0.95, 1], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(1, 0.6) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'flare' }, intensity: 5 }),
    });
    return createVfxDocument({ name: 'Propulsor', duration: 1, prewarm: 0.5, emitters: [jet, core] });
}
function buildSparks(): VfxDocument {
    const sparks = emitter(0, {
        name: 'Faíscas',
        maxParticles: 400,
        spawn: createSpawn({ rate: scalarConstant(0), bursts: [createBurst({ time: 0, count: 60, countMax: 110, cycles: 0, interval: 1.4, probability: 1 })] }),
        shape: createShape({ kind: 'hemisphere', radius: 0.05, thickness: 1, randomizeDirection: 0.15 }),
        initial: createInitial({
            lifetime: scalarRandom(0.5, 1.4),
            speed: scalarRandom(3.5, 8),
            size: scalarRandom(0.02, 0.045),
            rotation: scalarConstant(0),
            color: colorRandom([1, 0.95, 0.75], [1, 0.7, 0.3]),
        }),
        modules: [
            module('gravity', { scale: 1 }),
            module('drag', { coefficient: 0.9, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0.45, friction: 0.4, lifetimeLoss: 0.25, killOnCollide: false }),
            module('colorBySpeed', { gradient: gradient([[0, [1, 0.35, 0.1]], [1, [1, 0.95, 0.8]]], [[0, 0.6], [1, 1]]), speedMin: 0, speedMax: 6 }),
            module('sizeOverLife', { curve: createCurve([{ t: 0, v: 1 }, { t: 0.8, v: 0.9 }, { t: 1, v: 0 }]) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.08, stretchMinimum: 1.2, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 8 }),
    });
    const flash = emitter(1, {
        name: 'Clarão',
        maxParticles: 4,
        spawn: createSpawn({ rate: scalarConstant(0), bursts: [createBurst({ time: 0, count: 1, cycles: 0, interval: 1.4 })] }),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(0.2), speed: scalarConstant(0), size: scalarConstant(0.9), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.85, 0.6], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.6, 1.4) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.3) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 6 }),
    });
    return createVfxDocument({ name: 'Faíscas', duration: 1.4, emitters: [sparks, flash] });
}
function buildExplosion(): VfxDocument {
    const burst = (count: number, countMax = 0) => createSpawn({ rate: scalarConstant(0), bursts: [createBurst({ time: 0, count, countMax, cycles: 1 })] });
    const flash = emitter(0, {
        name: 'Clarão',
        maxParticles: 2,
        spawn: burst(1),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(0.3), speed: scalarConstant(0), size: scalarConstant(3), rotation: scalarRandom(0, 360), color: colorConstant([1, 0.9, 0.7], 1) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.4, 1.6) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.2) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 10 }),
    });
    const fireball = emitter(1, {
        name: 'Bola de fogo',
        maxParticles: 60,
        spawn: burst(28, 36),
        shape: createShape({ kind: 'sphere', radius: 0.3, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(0.7, 1.1),
            speed: scalarRandom(2.5, 6),
            size: scalarRandom(0.6, 1),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-60, 60),
            color: colorConstant([1, 0.8, 0.5], 1),
        }),
        modules: [
            module('drag', { coefficient: 3.5, curve: constantCurve(1) }),
            module('gravity', { scale: -0.25 }),
            module('sizeOverLife', { curve: linearCurve(0.6, 1.5) }),
            module('colorOverLife', { gradient: gradient([[0, [1, 0.95, 0.8]], [0.25, [1, 0.5, 0.1]], [0.6, [0.6, 0.1, 0.02]], [1, [0.1, 0.02, 0]]], [[0, 1], [0.5, 0.9], [1, 0]]) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'smoke' }, intensity: 4, softness: 0.5 }),
    });
    const smokeCloud = emitter(2, {
        name: 'Fumaça',
        maxParticles: 50,
        delay: 0.08,
        spawn: burst(22, 30),
        shape: createShape({ kind: 'sphere', radius: 0.5, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(2, 3.5),
            speed: scalarRandom(1.5, 3.5),
            size: scalarRandom(0.9, 1.4),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-20, 20),
            color: colorRandom([0.35, 0.33, 0.3], [0.15, 0.14, 0.13]),
        }),
        modules: [
            module('drag', { coefficient: 2.5, curve: constantCurve(1) }),
            module('gravity', { scale: -0.15 }),
            module('sizeOverLife', { curve: linearCurve(0.8, 2.4) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.85, 0.1, 0.4) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 1.2, sort: 'distance' }),
    });
    const debris = emitter(3, {
        name: 'Destroços',
        maxParticles: 120,
        spawn: burst(50, 80),
        shape: createShape({ kind: 'hemisphere', radius: 0.2, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(1.2, 2.5),
            speed: scalarRandom(5, 11),
            size: scalarRandom(0.04, 0.12),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-540, 540),
            color: colorRandom([0.3, 0.26, 0.22], [0.12, 0.1, 0.08]),
        }),
        modules: [
            module('gravity', { scale: 1.4 }),
            module('drag', { coefficient: 0.4, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0.3, friction: 0.5, lifetimeLoss: 0.2, killOnCollide: false }),
            module('colorOverLife', { gradient: gradient([[0, [1, 0.6, 0.3]], [0.3, WHITE]], [[0, 1], [0.8, 1], [1, 0]]) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'shard' }, lighting: 'lit', alphaCutoff: 0.4 }),
    });
    const shockwave = emitter(4, {
        name: 'Onda de choque',
        maxParticles: 2,
        spawn: burst(1),
        shape: createShape({ kind: 'point' }),
        initial: createInitial({ lifetime: scalarConstant(0.6), speed: scalarConstant(0), size: scalarConstant(1), rotation: scalarConstant(0), color: colorConstant([1, 0.85, 0.6], 1) }),
        modules: [module('sizeOverLife', { curve: createCurve([{ t: 0, v: 0.4 }, { t: 1, v: 7 }], 'linear') }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.9, 0.02, 0.2) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'ring' }, intensity: 3, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Explosão', duration: 3.5, emitters: [flash, fireball, smokeCloud, debris, shockwave] });
}
