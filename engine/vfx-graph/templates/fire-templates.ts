import type { VfxGraphDocument } from '../document/effect-document';
import { block, buildEffect, gradient, type SystemSpec } from './effect-builder';
const FLAMES: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 220 })] },
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [0.6, 1.1] }),
            block('position-circle', { center: [0, 0.05, 0], radius: 0.22, mode: 'area' }),
            block('velocity-direction', { direction: [0, 1, 0], speed: [0.9, 1.8], spread: 12 }),
            block('set-size', { size: [0.28, 0.5] }),
            block('set-rotation', { angle: [0, 360], spin: [-120, 120] }),
        ],
    },
    update: {
        blocks: [block('gravity', { strength: -1.2 }), block('turbulence', { strength: 2.2, frequency: 1.6, speed: 0.9 }), block('drag', { amount: 0.8 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 2.2 },
        blocks: [
            block('color-over-life', { gradient: gradient([0, 1, 0.85, 0.45, 1], [0.25, 1, 0.45, 0.08, 1], [0.6, 0.8, 0.12, 0.02, 0.8], [1, 0.2, 0.02, 0, 0]) }),
            block('size-over-life', { start: 1, end: 0.25, curve: 1.3 }),
            block('fade', { in: 0.08, out: 0.35 }),
        ],
    },
};
const CAMPFIRE_SMOKE: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 26 })] },
    initialize: {
        settings: { capacity: 512 },
        blocks: [
            block('set-lifetime', { seconds: [2.5, 4] }),
            block('position-circle', { center: [0, 0.7, 0], radius: 0.15, mode: 'area' }),
            block('velocity-direction', { direction: [0, 1, 0], speed: [0.5, 0.9], spread: 14 }),
            block('set-size', { size: [0.5, 0.8] }),
            block('set-rotation', { angle: [0, 360], spin: [-25, 25] }),
            block('set-color', { from: [0.05, 0.045, 0.04, 0.55], to: [0.09, 0.085, 0.08, 0.4] }),
        ],
    },
    update: {
        blocks: [block('turbulence', { strength: 0.9, frequency: 0.6, speed: 0.3 }), block('wind', { velocity: [0.25, 0, 0], response: 0.4 }), block('drag', { amount: 0.3 })],
    },
    output: {
        settings: { blend: 'alpha', shape: 'smoke', intensity: 1 },
        blocks: [block('size-over-life', { start: 0.6, end: 2.6, curve: 0.7 }), block('fade', { in: 0.2, out: 0.6 })],
    },
};
const EMBERS: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 18 })] },
    initialize: {
        settings: { capacity: 256 },
        blocks: [
            block('set-lifetime', { seconds: [1.2, 2.6] }),
            block('position-circle', { center: [0, 0.1, 0], radius: 0.2, mode: 'area' }),
            block('velocity-direction', { direction: [0, 1, 0], speed: [1.2, 2.6], spread: 25 }),
            block('set-size', { size: [0.02, 0.045] }),
            block('set-color', { from: [1, 0.6, 0.2, 1], to: [1, 0.35, 0.05, 1] }),
        ],
    },
    update: {
        blocks: [block('turbulence', { strength: 3, frequency: 1.1, speed: 0.8 }), block('gravity', { strength: -0.6 }), block('drag', { amount: 0.5 })],
    },
    output: {
        settings: { blend: 'additive', shape: 'soft', intensity: 4 },
        blocks: [block('fade', { in: 0.02, out: 0.5 }), block('flicker', { amount: 0.6, rate: 18 }), block('stretch-by-velocity', { factor: 0.03 })],
    },
};
const SMOKE_COLUMN: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 40 })] },
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [4, 6.5] }),
            block('position-circle', { center: [0, 0.05, 0], radius: 0.25, mode: 'area' }),
            block('velocity-direction', { direction: [0, 1, 0], speed: [0.8, 1.3], spread: 10 }),
            block('set-size', { size: [0.7, 1.1] }),
            block('set-rotation', { angle: [0, 360], spin: [-20, 20] }),
            block('set-color', { from: [0.16, 0.16, 0.17, 0.6], to: [0.3, 0.3, 0.31, 0.45] }),
        ],
    },
    update: {
        blocks: [block('turbulence', { strength: 1.1, frequency: 0.45, speed: 0.25 }), block('wind', { velocity: [0.6, 0, 0.1], response: 0.25 }), block('drag', { amount: 0.2 })],
    },
    output: {
        settings: { blend: 'alpha', shape: 'smoke', intensity: 1 },
        blocks: [
            block('color-over-life', { gradient: gradient([0, 0.5, 0.5, 0.5, 1], [0.3, 0.8, 0.8, 0.8, 1], [0.7, 1, 1, 1, 0.8], [1, 1, 1, 1, 0]) }),
            block('size-over-life', { start: 0.5, end: 3, curve: 0.6 }),
            block('fade', { in: 0.15, out: 0.65 }),
        ],
    },
};
export function buildCampfire(): VfxGraphDocument {
    return buildEffect([FLAMES, CAMPFIRE_SMOKE, EMBERS]);
}
export function buildSmokeColumn(): VfxGraphDocument {
    return buildEffect([SMOKE_COLUMN]);
}
