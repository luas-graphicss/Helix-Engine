import type { VfxGraphDocument } from '../document/effect-document';
import { block, buildEffect, type SystemSpec } from './effect-builder';
const RAIN: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 9000 })] },
    initialize: {
        settings: { capacity: 16384 },
        blocks: [
            block('set-lifetime', { seconds: [0.9, 1.2] }),
            block('position-box', { center: [0, 7, 0], size: [16, 0.5, 16] }),
            block('velocity-direction', { direction: [0.18, -1, 0.05], speed: [11, 14], spread: 2 }),
            block('set-size', { size: [0.012, 0.02] }),
            block('set-color', { from: [0.55, 0.65, 0.8, 0.55], to: [0.65, 0.75, 0.9, 0.4] }),
        ],
    },
    update: { blocks: [block('ground-collision', { height: 0, mode: 'kill' })] },
    output: {
        settings: { blend: 'additive', shape: 'streak', intensity: 1.2 },
        blocks: [block('stretch-by-velocity', { factor: 0.03 }), block('fade', { in: 0.05, out: 0.05 })],
    },
};
const RAIN_SPLASHES: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 900 })] },
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [0.15, 0.3] }),
            block('position-box', { center: [0, 0.03, 0], size: [16, 0, 16] }),
            block('set-size', { size: [0.1, 0.22] }),
            block('set-color', { from: [0.6, 0.7, 0.85, 0.5], to: [0.6, 0.7, 0.85, 0.3] }),
        ],
    },
    update: { blocks: [] },
    output: {
        settings: { blend: 'additive', shape: 'ring', orientation: 'ground', intensity: 0.8 },
        blocks: [block('size-over-life', { start: 0.2, end: 1, curve: 0.6 }), block('fade', { in: 0, out: 0.7 })],
    },
};
const STORM_FOG: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 14 })] },
    initialize: {
        settings: { capacity: 256 },
        blocks: [
            block('set-lifetime', { seconds: [5, 8] }),
            block('position-box', { center: [0, 0.6, 0], size: [16, 1, 16] }),
            block('velocity-random', { speed: [0.1, 0.4] }),
            block('set-size', { size: [3, 5] }),
            block('set-rotation', { angle: [0, 360], spin: [-8, 8] }),
            block('set-color', { from: [0.22, 0.26, 0.32, 0.16], to: [0.3, 0.34, 0.4, 0.1] }),
        ],
    },
    update: { blocks: [block('wind', { velocity: [1.2, 0, 0.3], response: 0.3 })] },
    output: {
        settings: { blend: 'alpha', shape: 'smoke', intensity: 1 },
        blocks: [block('fade', { in: 0.3, out: 0.4 })],
    },
};
const DISTANT_FLASH: SystemSpec = {
    spawn: { settings: { loop: 'loop', duration: 7.4 }, blocks: [block('spawn-burst', { count: 1, time: 1.2, interval: 3.7 })] },
    initialize: {
        settings: { capacity: 8 },
        blocks: [
            block('set-lifetime', { seconds: [0.12, 0.2] }),
            block('position-box', { center: [0, 6, -6], size: [10, 1, 2] }),
            block('set-size', { size: [14, 18] }),
            block('set-color', { from: [0.7, 0.8, 1, 0.5], to: [0.8, 0.85, 1, 0.4] }),
        ],
    },
    update: { blocks: [] },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 2.5 },
        blocks: [block('fade', { in: 0, out: 0.8 }), block('flicker', { amount: 0.8, rate: 40 })],
    },
};
const SNOW: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 700 })] },
    initialize: {
        settings: { capacity: 8192 },
        blocks: [
            block('set-lifetime', { seconds: [7, 9] }),
            block('position-box', { center: [0, 6, 0], size: [14, 0.5, 14] }),
            block('velocity-direction', { direction: [0, -1, 0], speed: [0.6, 1.1], spread: 20 }),
            block('set-size', { size: [0.025, 0.06] }),
            block('set-color', { from: [0.9, 0.94, 1, 0.9], to: [1, 1, 1, 0.7] }),
        ],
    },
    update: {
        blocks: [block('turbulence', { strength: 0.8, frequency: 0.5, speed: 0.3 }), block('wind', { velocity: [0.4, -0.9, 0], response: 0.5 }), block('ground-collision', { height: 0.01, mode: 'stick' })],
    },
    output: {
        settings: { blend: 'alpha', shape: 'soft', intensity: 1 },
        blocks: [block('fade', { in: 0.1, out: 0.2 })],
    },
};
const FIREFLIES: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 12 })] },
    initialize: {
        settings: { capacity: 256 },
        blocks: [
            block('set-lifetime', { seconds: [4, 8] }),
            block('position-box', { center: [0, 1.2, 0], size: [8, 2, 8] }),
            block('velocity-random', { speed: [0.1, 0.4] }),
            block('set-size', { size: [0.05, 0.09] }),
            block('set-color', { from: [0.75, 1, 0.3, 1], to: [1, 0.9, 0.3, 1] }),
        ],
    },
    update: {
        blocks: [block('turbulence', { strength: 1.4, frequency: 0.7, speed: 0.4 }), block('drag', { amount: 1.2 }), block('jitter', { strength: 1.5 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 4 },
        blocks: [block('fade', { in: 0.2, out: 0.3 }), block('flicker', { amount: 0.85, rate: 3 })],
    },
};
const DUST_MOTES: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 60 })] },
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [6, 10] }),
            block('position-box', { center: [0, 1.5, 0], size: [9, 3, 9] }),
            block('velocity-random', { speed: [0.02, 0.1] }),
            block('set-size', { size: [0.012, 0.03] }),
            block('set-color', { from: [1, 0.95, 0.85, 0.35], to: [1, 0.95, 0.85, 0.2] }),
        ],
    },
    update: { blocks: [block('turbulence', { strength: 0.3, frequency: 0.5, speed: 0.2 })] },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 0.8 },
        blocks: [block('fade', { in: 0.3, out: 0.3 })],
    },
};
export function buildStorm(): VfxGraphDocument {
    return buildEffect([RAIN, RAIN_SPLASHES, STORM_FOG, DISTANT_FLASH]);
}
export function buildSnowfall(): VfxGraphDocument {
    return buildEffect([SNOW]);
}
export function buildFireflies(): VfxGraphDocument {
    return buildEffect([FIREFLIES, DUST_MOTES]);
}
