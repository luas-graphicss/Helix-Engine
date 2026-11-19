import type { VfxGraphDocument } from '../document/effect-document';
import { block, buildEffect, gradient, type SystemSpec } from './effect-builder';
const VORTEX_CENTER = [0, 1.2, 0];
const STRIKE_TIMES = [0, 0.05, 0.1, 0.16];
const ARCANE_SWIRL: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 900 })] },
    initialize: {
        settings: { capacity: 4096 },
        blocks: [
            block('set-lifetime', { seconds: [1.6, 3] }),
            block('position-circle', { center: [0, 0.05, 0], radius: 1.2, mode: 'edge' }),
            block('velocity-tangent', { center: [0, 0, 0], speed: [1.5, 2.6] }),
            block('set-size', { size: [0.03, 0.07] }),
            block('set-color', { from: [0.2, 0.95, 0.85, 1], to: [1, 0.8, 0.3, 1] }),
        ],
    },
    update: {
        blocks: [
            block('vortex', { center: [0, 0, 0], axis: [0, 1, 0], strength: 1.6, pull: 1.2 }),
            block('gravity', { strength: -1.1 }),
            block('turbulence', { strength: 1.2, frequency: 1.4, speed: 0.7 }),
            block('drag', { amount: 0.4 }),
        ],
    },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 3.5 },
        blocks: [
            block('color-over-life', { gradient: gradient([0, 1, 1, 1, 0], [0.15, 1, 1, 1, 1], [0.7, 0.6, 0.9, 1, 0.9], [1, 0.2, 0.4, 1, 0]) }),
            block('size-over-life', { start: 1, end: 0.2, curve: 1 }),
            block('flicker', { amount: 0.5, rate: 16 }),
        ],
    },
};
const ARCANE_CORE: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 60 })] },
    initialize: {
        settings: { capacity: 256 },
        blocks: [
            block('set-lifetime', { seconds: [0.5, 0.9] }),
            block('position-sphere', { center: VORTEX_CENTER, radius: 0.12, mode: 'volume' }),
            block('velocity-random', { speed: [0.1, 0.5] }),
            block('set-size', { size: [0.4, 0.8] }),
            block('set-color', { from: [0.2, 0.9, 0.85, 0.5], to: [0.5, 1, 0.9, 0.4] }),
        ],
    },
    update: { blocks: [block('attractor', { center: VORTEX_CENTER, strength: 3, radius: 2 })] },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 2 },
        blocks: [block('size-over-life', { start: 0.6, end: 1.2, curve: 1 }), block('fade', { in: 0.3, out: 0.6 })],
    },
};
const RUNE_RING: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 3 })] },
    initialize: {
        settings: { capacity: 16 },
        blocks: [
            block('set-lifetime', { seconds: [1.2, 1.2] }),
            block('position-sphere', { center: [0, 0.03, 0], radius: 0 }),
            block('set-size', { size: [2.6, 2.6] }),
            block('set-color', { from: [0.2, 0.95, 0.85, 0.7], to: [0.2, 0.95, 0.85, 0.7] }),
        ],
    },
    update: { blocks: [] },
    output: {
        settings: { blend: 'additive', shape: 'ring', orientation: 'ground', intensity: 1.6 },
        blocks: [block('size-over-life', { start: 0.85, end: 1.05, curve: 1 }), block('fade', { in: 0.3, out: 0.5 })],
    },
};
const LIGHTNING_BOLT: SystemSpec = {
    spawn: { settings: { loop: 'loop', duration: 1.6 }, blocks: STRIKE_TIMES.map((time) => block('spawn-burst', { count: 1200, time, interval: 0 })) },
    initialize: {
        settings: { capacity: 8192 },
        blocks: [
            block('set-lifetime', { seconds: [0.06, 0.1] }),
            block('position-arc', { start: [0.4, 4.2, 0], end: [0, 0, 0], amplitude: 0.55, segments: 9, rate: 22 }),
            block('set-size', { size: [0.045, 0.09] }),
            block('set-color', { from: [0.75, 0.85, 1, 1], to: [0.9, 0.95, 1, 1] }),
        ],
    },
    update: { blocks: [block('jitter', { strength: 8 })] },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 9 },
        blocks: [block('fade', { in: 0, out: 0.6 })],
    },
};
const STRIKE_GLOW: SystemSpec = {
    spawn: { settings: { loop: 'loop', duration: 1.6 }, blocks: [block('spawn-burst', { count: 1, time: 0, interval: 0 })] },
    initialize: {
        settings: { capacity: 8 },
        blocks: [
            block('set-lifetime', { seconds: [0.25, 0.3] }),
            block('position-sphere', { center: [0, 0.1, 0], radius: 0 }),
            block('set-size', { size: [5, 5] }),
            block('set-color', { from: [0.6, 0.75, 1, 0.8], to: [0.6, 0.75, 1, 0.8] }),
        ],
    },
    update: { blocks: [] },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 3 },
        blocks: [block('fade', { in: 0, out: 0.9 }), block('flicker', { amount: 0.6, rate: 40 })],
    },
};
const STRIKE_SPARKS: SystemSpec = {
    spawn: { settings: { loop: 'loop', duration: 1.6 }, blocks: [block('spawn-burst', { count: 90, time: 0.02, interval: 0 })] },
    initialize: {
        settings: { capacity: 512 },
        blocks: [
            block('set-lifetime', { seconds: [0.3, 0.9] }),
            block('position-sphere', { center: [0, 0.05, 0], radius: 0.1, mode: 'volume' }),
            block('velocity-direction', { direction: [0, 1, 0], speed: [2, 7], spread: 60 }),
            block('set-size', { size: [0.02, 0.04] }),
            block('set-color', { from: [0.8, 0.9, 1, 1], to: [0.6, 0.8, 1, 1] }),
        ],
    },
    update: {
        blocks: [block('gravity', { strength: 9.81 }), block('drag', { amount: 1 }), block('ground-collision', { height: 0, mode: 'bounce', bounce: 0.4, friction: 0.3 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'streak', intensity: 5 },
        blocks: [block('stretch-by-velocity', { factor: 0.04 }), block('fade', { in: 0, out: 0.5 })],
    },
};
const GALAXY: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 60000 })] },
    initialize: {
        settings: { capacity: 400000 },
        blocks: [
            block('set-lifetime', { seconds: [5, 6.5] }),
            block('position-sphere', { center: [0, 2, 0], radius: 3, mode: 'surface' }),
            block('velocity-tangent', { center: [0, 2, 0], speed: [0.5, 2.5] }),
            block('set-size', { size: [0.012, 0.03] }),
            block('set-color', { from: [0.4, 0.7, 1, 1], to: [1, 0.6, 0.3, 1] }),
        ],
    },
    update: {
        blocks: [
            block('vortex', { center: [0, 2, 0], axis: [0, 1, 0], strength: 0.9, pull: 0.35 }),
            block('attractor', { center: [0, 2, 0], strength: 2, radius: 6 }),
            block('turbulence', { strength: 0.6, frequency: 0.5, speed: 0.2 }),
        ],
    },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 0.9 },
        blocks: [block('fade', { in: 0.1, out: 0.3 })],
    },
};
export function buildArcaneVortex(): VfxGraphDocument {
    return buildEffect([ARCANE_SWIRL, ARCANE_CORE, RUNE_RING]);
}
export function buildLightning(): VfxGraphDocument {
    return buildEffect([LIGHTNING_BOLT, STRIKE_GLOW, STRIKE_SPARKS]);
}
export function buildGalaxy(): VfxGraphDocument {
    return buildEffect([GALAXY]);
}
