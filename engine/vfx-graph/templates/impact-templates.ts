import type { VfxGraphDocument } from '../document/effect-document';
import { block, buildEffect, gradient, type ContextSpec, type SystemSpec } from './effect-builder';
const BLAST_CENTER = [0, 0.6, 0];
function burstEvery(seconds: number, count: number, time = 0): ContextSpec {
    return { settings: { loop: 'loop', duration: seconds }, blocks: [block('spawn-burst', { count, time, interval: 0 })] };
}
const BLAST_FLASH: SystemSpec = {
    spawn: burstEvery(3, 1),
    initialize: {
        settings: { capacity: 8 },
        blocks: [block('set-lifetime', { seconds: [0.12, 0.16] }), block('position-sphere', { center: BLAST_CENTER, radius: 0 }), block('set-size', { size: [5, 6] }), block('set-color', { from: [1, 0.9, 0.7, 1], to: [1, 0.85, 0.6, 1] })],
    },
    update: { blocks: [] },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 6 },
        blocks: [block('size-over-life', { start: 0.3, end: 1, curve: 0.4 }), block('fade', { in: 0, out: 0.9 })],
    },
};
const FIREBALL: SystemSpec = {
    spawn: burstEvery(3, 260),
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [0.5, 1.1] }),
            block('position-sphere', { center: BLAST_CENTER, radius: 0.25, mode: 'volume' }),
            block('velocity-radial', { center: BLAST_CENTER, speed: [2, 9] }),
            block('set-size', { size: [0.5, 1.1] }),
            block('set-rotation', { angle: [0, 360], spin: [-90, 90] }),
        ],
    },
    update: {
        blocks: [block('drag', { amount: 3.2 }), block('gravity', { strength: -1.5 }), block('turbulence', { strength: 3, frequency: 1.2, speed: 1 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'smoke', intensity: 3 },
        blocks: [
            block('color-over-life', { gradient: gradient([0, 1, 0.92, 0.6, 1], [0.2, 1, 0.5, 0.1, 1], [0.55, 0.6, 0.1, 0.02, 0.7], [1, 0.1, 0.02, 0.01, 0]) }),
            block('size-over-life', { start: 0.5, end: 1.6, curve: 0.5 }),
            block('fade', { in: 0.02, out: 0.5 }),
        ],
    },
};
const BLAST_SMOKE: SystemSpec = {
    spawn: burstEvery(3, 120, 0.05),
    initialize: {
        settings: { capacity: 512 },
        blocks: [
            block('set-lifetime', { seconds: [2, 2.9] }),
            block('position-sphere', { center: [0, 0.7, 0], radius: 0.5, mode: 'volume' }),
            block('velocity-radial', { center: [0, 0.4, 0], speed: [0.8, 3] }),
            block('set-size', { size: [0.9, 1.6] }),
            block('set-rotation', { angle: [0, 360], spin: [-30, 30] }),
            block('set-color', { from: [0.05, 0.05, 0.05, 0.7], to: [0.12, 0.11, 0.1, 0.5] }),
        ],
    },
    update: {
        blocks: [block('drag', { amount: 1.8 }), block('gravity', { strength: -0.5 }), block('turbulence', { strength: 1.2, frequency: 0.6, speed: 0.4 })],
    },
    output: {
        settings: { blend: 'alpha', shape: 'smoke', intensity: 1 },
        blocks: [block('size-over-life', { start: 0.6, end: 2.4, curve: 0.5 }), block('fade', { in: 0.1, out: 0.6 })],
    },
};
const BLAST_SPARKS: SystemSpec = {
    spawn: burstEvery(3, 400),
    initialize: {
        settings: { capacity: 2048 },
        blocks: [
            block('set-lifetime', { seconds: [0.6, 1.6] }),
            block('position-sphere', { center: BLAST_CENTER, radius: 0.1, mode: 'volume' }),
            block('velocity-random', { speed: [5, 16] }),
            block('set-size', { size: [0.03, 0.06] }),
            block('set-color', { from: [1, 0.75, 0.35, 1], to: [1, 0.5, 0.15, 1] }),
        ],
    },
    update: {
        blocks: [block('gravity', { strength: 9.81 }), block('drag', { amount: 0.9 }), block('ground-collision', { height: 0, mode: 'bounce', bounce: 0.35, friction: 0.4 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'streak', intensity: 5 },
        blocks: [block('stretch-by-velocity', { factor: 0.045 }), block('fade', { in: 0, out: 0.5 })],
    },
};
const SHOCKWAVE: SystemSpec = {
    spawn: burstEvery(3, 1),
    initialize: {
        settings: { capacity: 8 },
        blocks: [block('set-lifetime', { seconds: [0.5, 0.6] }), block('position-sphere', { center: [0, 0.05, 0], radius: 0 }), block('set-size', { size: [9, 9] }), block('set-color', { from: [1, 0.8, 0.55, 0.8], to: [1, 0.8, 0.55, 0.8] })],
    },
    update: { blocks: [] },
    output: {
        settings: { blend: 'additive', shape: 'ring', orientation: 'ground', intensity: 2 },
        blocks: [block('size-over-life', { start: 0.05, end: 1, curve: 0.45 }), block('fade', { in: 0, out: 0.7 })],
    },
};
const WELDING_SPARKS: SystemSpec = {
    spawn: { settings: { loop: 'loop', duration: 5 }, blocks: [block('spawn-burst', { count: 60, time: 0, interval: 0.35 })] },
    initialize: {
        settings: { capacity: 2048 },
        blocks: [
            block('set-lifetime', { seconds: [0.4, 1.3] }),
            block('position-sphere', { center: [0, 1, 0], radius: 0.03, mode: 'volume' }),
            block('velocity-direction', { direction: [0.3, 1, 0], speed: [3, 9], spread: 38 }),
            block('set-size', { size: [0.02, 0.04] }),
            block('set-color', { from: [1, 0.8, 0.4, 1], to: [1, 0.55, 0.15, 1] }),
        ],
    },
    update: {
        blocks: [block('gravity', { strength: 9.81 }), block('drag', { amount: 0.6 }), block('ground-collision', { height: 0, mode: 'bounce', bounce: 0.45, friction: 0.35 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'streak', intensity: 6 },
        blocks: [block('stretch-by-velocity', { factor: 0.04 }), block('fade', { in: 0, out: 0.4 }), block('flicker', { amount: 0.3, rate: 30 })],
    },
};
const BLOOD_DROPLETS: SystemSpec = {
    spawn: burstEvery(1.8, 140),
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [0.9, 1.6] }),
            block('position-sphere', { center: [0, 1.2, 0], radius: 0.06, mode: 'volume' }),
            block('velocity-direction', { direction: [1, 0.55, 0], speed: [1.5, 6.5], spread: 30 }),
            block('set-size', { size: [0.03, 0.085] }),
            block('set-color', { from: [0.42, 0.008, 0.008, 1], to: [0.2, 0.004, 0.004, 0.95] }),
        ],
    },
    update: {
        blocks: [block('gravity', { strength: 9.81 }), block('drag', { amount: 0.5 }), block('ground-collision', { height: 0.01, mode: 'stick' })],
    },
    output: {
        settings: { blend: 'alpha', shape: 'disc', intensity: 1 },
        blocks: [block('stretch-by-velocity', { factor: 0.05 }), block('fade', { in: 0, out: 0.25 })],
    },
};
const BLOOD_MIST: SystemSpec = {
    spawn: burstEvery(1.8, 40),
    initialize: {
        settings: { capacity: 256 },
        blocks: [
            block('set-lifetime', { seconds: [0.35, 0.7] }),
            block('position-sphere', { center: [0, 1.2, 0], radius: 0.1, mode: 'volume' }),
            block('velocity-direction', { direction: [1, 0.4, 0], speed: [0.5, 2.5], spread: 45 }),
            block('set-size', { size: [0.18, 0.4] }),
            block('set-color', { from: [0.35, 0.01, 0.01, 0.35], to: [0.25, 0.006, 0.006, 0.3] }),
        ],
    },
    update: { blocks: [block('drag', { amount: 3 }), block('gravity', { strength: 1.5 })] },
    output: {
        settings: { blend: 'alpha', shape: 'soft', intensity: 1 },
        blocks: [block('size-over-life', { start: 0.6, end: 1.8, curve: 0.6 }), block('fade', { in: 0.05, out: 0.7 })],
    },
};
export function buildExplosion(): VfxGraphDocument {
    return buildEffect([BLAST_FLASH, FIREBALL, BLAST_SMOKE, BLAST_SPARKS, SHOCKWAVE]);
}
export function buildSparks(): VfxGraphDocument {
    return buildEffect([WELDING_SPARKS]);
}
export function buildBloodSplatter(): VfxGraphDocument {
    return buildEffect([BLOOD_DROPLETS, BLOOD_MIST]);
}
