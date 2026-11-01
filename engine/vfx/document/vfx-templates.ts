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
function buildDustImpact(): VfxDocument {
    const puff = emitter(0, {
        name: 'Poeira',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(0), bursts: [createBurst({ time: 0, count: 24, countMax: 32, cycles: 0, interval: 1.6 })] }),
        shape: createShape({ kind: 'circle', radius: 0.25, thickness: 0.3, emitFrom: 'edge' }),
        initial: createInitial({
            lifetime: scalarRandom(0.8, 1.5),
            speed: scalarRandom(1.5, 3.5),
            size: scalarRandom(0.35, 0.6),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-30, 30),
            color: colorRandom([0.78, 0.7, 0.58], [0.6, 0.52, 0.42]),
        }),
        modules: [
            module('drag', { coefficient: 3, curve: constantCurve(1) }),
            module('gravity', { scale: 0.12 }),
            module('sizeOverLife', { curve: linearCurve(0.6, 1.8) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.75, 0.08, 0.4) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'smoke' }, lighting: 'lit', softness: 0.8, sort: 'distance' }),
    });
    const grit = emitter(1, {
        name: 'Pedriscos',
        maxParticles: 60,
        spawn: createSpawn({ rate: scalarConstant(0), bursts: [createBurst({ time: 0, count: 18, countMax: 26, cycles: 0, interval: 1.6 })] }),
        shape: createShape({ kind: 'hemisphere', radius: 0.1, thickness: 1 }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 1), speed: scalarRandom(2, 4.5), size: scalarRandom(0.02, 0.05), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-360, 360), color: colorConstant([0.55, 0.48, 0.4], 1) }),
        modules: [module('gravity', { scale: 1.2 }), module('collision', { planeHeight: 0, bounce: 0.25, friction: 0.6, lifetimeLoss: 0.3, killOnCollide: false })],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'square' }, lighting: 'lit' }),
    });
    return createVfxDocument({ name: 'Impacto de poeira', duration: 1.6, emitters: [puff, grit] });
}
function buildRain(): VfxDocument {
    const drops = emitter(0, {
        name: 'Gotas',
        maxParticles: 2500,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(900) }),
        shape: createShape({ kind: 'box', size: [12, 0.2, 12], offset: [0, 9, 0], rotation: [180, 0, 0] }),
        initial: createInitial({
            lifetime: scalarConstant(1.1),
            speed: scalarRandom(11, 14),
            size: scalarRandom(0.02, 0.03),
            aspect: 1,
            rotation: scalarConstant(0),
            color: colorConstant([0.75, 0.85, 1], 0.55),
        }),
        modules: [module('force', { force: [0.8, 0, 0.2], randomize: 0.1, space: 'world' }), module('collision', { planeHeight: 0, bounce: 0, friction: 1, lifetimeLoss: 1, killOnCollide: true })],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.045, stretchMinimum: 4, blend: 'alpha', texture: { kind: 'builtin', id: 'soft' }, intensity: 1.2 }),
    });
    const splashes = emitter(1, {
        name: 'Respingos',
        maxParticles: 400,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(140) }),
        shape: createShape({ kind: 'box', size: [12, 0, 12], offset: [0, 0.02, 0] }),
        initial: createInitial({ lifetime: scalarRandom(0.25, 0.4), speed: scalarConstant(0), size: scalarRandom(0.08, 0.14), rotation: scalarConstant(0), color: colorConstant([0.8, 0.9, 1], 0.5) }),
        modules: [module('sizeOverLife', { curve: linearCurve(0.3, 1.4) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.8, 0.1, 0.3) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'alpha', texture: { kind: 'builtin', id: 'ring' }, softness: 0.2 }),
    });
    return createVfxDocument({ name: 'Chuva', duration: 4, prewarm: 1.5, cullRadius: 14, emitters: [drops, splashes] });
}
function buildSnow(): VfxDocument {
    const flakes = emitter(0, {
        name: 'Flocos',
        maxParticles: 1200,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(160) }),
        shape: createShape({ kind: 'box', size: [12, 0.2, 12], offset: [0, 7, 0], rotation: [180, 0, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(6, 9),
            speed: scalarRandom(0.6, 1.1),
            size: scalarRandom(0.03, 0.08),
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-90, 90),
            color: colorConstant(WHITE, 0.9),
        }),
        modules: [
            module('noise', { strength: 0.6, frequency: 0.35, scrollSpeed: 0.2, octaves: 2, curve: constantCurve(1) }),
            module('force', { force: [0.25, 0, 0.05], randomize: 0.4, space: 'world' }),
            module('collision', { planeHeight: 0, bounce: 0, friction: 1, lifetimeLoss: 1, killOnCollide: true }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.9) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'soft' }, lighting: 'lit', intensity: 1.1, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Neve', duration: 6, prewarm: 6, cullRadius: 14, emitters: [flakes] });
}
function buildLeaves(): VfxDocument {
    const leaves = emitter(0, {
        name: 'Folhas',
        maxParticles: 200,
        space: 'world',
        spawn: createSpawn({ rate: scalarConstant(10) }),
        shape: createShape({ kind: 'box', size: [1, 3, 8], offset: [-5, 2.5, 0], rotation: [0, 0, -90] }),
        initial: createInitial({
            lifetime: scalarRandom(5, 8),
            speed: scalarRandom(1.5, 3),
            size: scalarRandom(0.12, 0.2),
            aspect: 0.7,
            rotation: scalarRandom(0, 360),
            angularVelocity: scalarRandom(-240, 240),
            color: colorRandom([0.85, 0.55, 0.2], [0.45, 0.6, 0.18]),
        }),
        modules: [
            module('force', { force: [1.5, 0, 0], randomize: 0.5, space: 'world' }),
            module('noise', { strength: 1.8, frequency: 0.4, scrollSpeed: 0.5, octaves: 2, curve: constantCurve(1) }),
            module('gravity', { scale: 0.25 }),
            module('drag', { coefficient: 0.8, curve: constantCurve(1) }),
            module('collision', { planeHeight: 0, bounce: 0.1, friction: 0.9, lifetimeLoss: 0.4, killOnCollide: false }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.05, 0.85) }),
        ],
        renderer: createRenderer({ blend: 'alpha', texture: { kind: 'builtin', id: 'shard' }, lighting: 'lit', alphaCutoff: 0.5, sort: 'distance' }),
    });
    return createVfxDocument({ name: 'Folhas ao vento', duration: 6, prewarm: 4, cullRadius: 12, emitters: [leaves] });
}
function buildFireflies(): VfxDocument {
    const fireflies = emitter(0, {
        name: 'Vagalumes',
        maxParticles: 80,
        spawn: createSpawn({ rate: scalarConstant(9) }),
        shape: createShape({ kind: 'box', size: [5, 2, 5], offset: [0, 1.2, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(4, 7),
            speed: scalarRandom(0.1, 0.3),
            size: scalarRandom(0.05, 0.09),
            rotation: scalarConstant(0),
            color: colorRandom([0.85, 1, 0.45], [1, 0.9, 0.4]),
        }),
        modules: [
            module('noise', { strength: 0.5, frequency: 0.4, scrollSpeed: 0.3, octaves: 2, curve: constantCurve(1) }),
            module('limitVelocity', { speed: 0.5, dampen: 0.3 }),
            module('colorOverLife', { gradient: gradient([[0, WHITE]], [[0, 0], [0.15, 1], [0.3, 0.1], [0.45, 1], [0.6, 0.05], [0.75, 0.9], [1, 0]]) }),
            module('sizeOverLife', { curve: bellCurve(0.6, 1, 0.5) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 4 }),
    });
    return createVfxDocument({ name: 'Vagalumes', duration: 5, prewarm: 5, emitters: [fireflies] });
}
function buildMagicAura(): VfxDocument {
    const orbs = emitter(0, {
        name: 'Luzes em órbita',
        maxParticles: 160,
        spawn: createSpawn({ rate: scalarConstant(32) }),
        shape: createShape({ kind: 'circle', radius: 0.7, thickness: 0.25, offset: [0, 0.1, 0] }),
        initial: createInitial({
            lifetime: scalarRandom(1.6, 2.6),
            speed: scalarRandom(0.25, 0.5),
            size: scalarRandom(0.06, 0.14),
            rotation: scalarConstant(0),
            color: colorRandom([0.6, 0.4, 1], [0.3, 0.9, 1]),
        }),
        modules: [
            module('orbit', { speed: 2.4, radial: -0.15, axis: [0, 1, 0] }),
            module('force', { force: [0, 0.9, 0], randomize: 0.2, space: 'local' }),
            module('noise', { strength: 0.3, frequency: 1, scrollSpeed: 0.5, octaves: 1, curve: constantCurve(1) }),
            module('sizeOverLife', { curve: bellCurve(0, 1, 0.4) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.1, 0.7) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 4.5 }),
    });
    const sparkles = emitter(1, {
        name: 'Brilhos',
        maxParticles: 60,
        spawn: createSpawn({ rate: scalarConstant(12) }),
        shape: createShape({ kind: 'sphere', radius: 0.9, thickness: 1, offset: [0, 0.9, 0] }),
        initial: createInitial({ lifetime: scalarRandom(0.5, 1.1), speed: scalarConstant(0), size: scalarRandom(0.08, 0.18), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-90, 90), color: colorConstant([0.9, 0.85, 1], 1) }),
        modules: [module('sizeOverLife', { curve: bellCurve(0, 1, 0.5) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.2, 0.6) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'star' }, intensity: 6 }),
    });
    const base = emitter(2, {
        name: 'Base',
        maxParticles: 6,
        spawn: createSpawn({ rate: scalarConstant(2) }),
        shape: createShape({ kind: 'point', offset: [0, 0.03, 0] }),
        initial: createInitial({ lifetime: scalarConstant(2), speed: scalarConstant(0), size: scalarConstant(1.8), rotation: scalarConstant(0), angularVelocity: scalarConstant(25), color: colorConstant([0.45, 0.35, 1], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.6, 0.25, 0.6) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'ring' }, intensity: 2, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Aura mágica', duration: 3, prewarm: 3, emitters: [orbs, sparkles, base] });
}
function buildPortal(): VfxDocument {
    const ring = emitter(0, {
        name: 'Anel',
        maxParticles: 500,
        spawn: createSpawn({ rate: scalarConstant(140) }),
        shape: createShape({ kind: 'circle', radius: 1.2, thickness: 0.1, emitFrom: 'edge', rotation: [90, 0, 0], offset: [0, 1.4, 0], spherizeDirection: 0 }),
        initial: createInitial({
            lifetime: scalarRandom(0.8, 1.6),
            speed: scalarRandom(0.1, 0.4),
            size: scalarRandom(0.06, 0.16),
            rotation: scalarConstant(0),
            color: colorRandom([0.5, 0.25, 1], [0.2, 0.7, 1]),
        }),
        modules: [
            module('vortex', { axis: [0, 0, 1], strength: 3.2, pull: 0.35 }),
            module('sizeOverLife', { curve: bellCurve(0.2, 1, 0.3) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.1, 0.6) }),
        ],
        renderer: createRenderer({ mode: 'stretched', stretch: 0.12, blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 5 }),
    });
    const core = emitter(1, {
        name: 'Núcleo',
        maxParticles: 12,
        spawn: createSpawn({ rate: scalarConstant(5) }),
        shape: createShape({ kind: 'point', offset: [0, 1.4, 0] }),
        initial: createInitial({ lifetime: scalarConstant(1.6), speed: scalarConstant(0), size: scalarRandom(1.6, 2.2), rotation: scalarRandom(0, 360), angularVelocity: scalarRandom(-30, 30), color: colorConstant([0.3, 0.15, 0.8], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.55, 0.3, 0.6) })],
        renderer: createRenderer({ mode: 'vertical', blend: 'additive', texture: { kind: 'builtin', id: 'noise' }, intensity: 2.5, softness: 0.5 }),
    });
    const motes = emitter(2, {
        name: 'Fagulhas',
        maxParticles: 100,
        spawn: createSpawn({ rate: scalarConstant(20) }),
        shape: createShape({ kind: 'circle', radius: 1.1, thickness: 1, rotation: [90, 0, 0], offset: [0, 1.4, 0] }),
        initial: createInitial({ lifetime: scalarRandom(1.5, 3), speed: scalarRandom(0.3, 0.9), size: scalarRandom(0.02, 0.05), rotation: scalarConstant(0), color: colorConstant([0.8, 0.7, 1], 1) }),
        modules: [module('attractor', { position: [0, 1.4, 0], strength: 2.5, radius: 0.15, kill: true }), module('noise', { strength: 0.8, frequency: 1.5, scrollSpeed: 0.8, octaves: 1, curve: constantCurve(1) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 7 }),
    });
    return createVfxDocument({ name: 'Portal', duration: 3, prewarm: 3, emitters: [ring, core, motes] });
}
function buildHealing(): VfxDocument {
    const motes = emitter(0, {
        name: 'Partículas de cura',
        maxParticles: 140,
        spawn: createSpawn({ rate: scalarConstant(30) }),
        shape: createShape({ kind: 'circle', radius: 0.55, thickness: 1 }),
        initial: createInitial({
            lifetime: scalarRandom(1.3, 2.2),
            speed: scalarRandom(0.7, 1.3),
            size: scalarRandom(0.05, 0.11),
            rotation: scalarConstant(0),
            color: colorRandom([0.55, 1, 0.5], [0.9, 1, 0.55]),
        }),
        modules: [
            module('noise', { strength: 0.35, frequency: 1.2, scrollSpeed: 0.6, octaves: 1, curve: constantCurve(1) }),
            module('velocityOverLife', { speedCurve: linearCurve(1, 0.5), linear: [0, 0, 0], space: 'local' }),
            module('sizeOverLife', { curve: bellCurve(0, 1, 0.35) }),
            module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.15, 0.65) }),
        ],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 4 }),
    });
    const crosses = emitter(1, {
        name: 'Cruzes',
        maxParticles: 30,
        spawn: createSpawn({ rate: scalarConstant(5) }),
        shape: createShape({ kind: 'circle', radius: 0.4, thickness: 1, offset: [0, 0.3, 0] }),
        initial: createInitial({ lifetime: scalarRandom(1.2, 1.8), speed: scalarRandom(0.5, 0.8), size: scalarRandom(0.14, 0.2), rotation: scalarConstant(0), color: colorConstant([0.7, 1, 0.7], 1) }),
        modules: [module('sizeOverLife', { curve: bellCurve(0, 1, 0.3) }), module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 1, 0.2, 0.6) })],
        renderer: createRenderer({ blend: 'additive', texture: { kind: 'builtin', id: 'cross' }, intensity: 5 }),
    });
    const glow = emitter(2, {
        name: 'Brilho no chão',
        maxParticles: 6,
        spawn: createSpawn({ rate: scalarConstant(2) }),
        shape: createShape({ kind: 'point', offset: [0, 0.03, 0] }),
        initial: createInitial({ lifetime: scalarConstant(2.2), speed: scalarConstant(0), size: scalarConstant(1.6), rotation: scalarConstant(0), color: colorConstant([0.5, 1, 0.5], 1) }),
        modules: [module('colorOverLife', { gradient: fadeInOutGradient(WHITE, 0.5, 0.3, 0.6) }), module('sizeOverLife', { curve: bellCurve(0.7, 1, 0.5) })],
        renderer: createRenderer({ mode: 'horizontal', blend: 'additive', texture: { kind: 'builtin', id: 'soft' }, intensity: 1.8, softness: 0.3 }),
    });
    return createVfxDocument({ name: 'Cura', duration: 2.5, prewarm: 2.5, emitters: [motes, crosses, glow] });
}
