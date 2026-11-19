import { block, type SystemSpec } from './effect-builder';
export const STARTER_SYSTEM: SystemSpec = {
    spawn: { blocks: [block('spawn-rate', { rate: 80 })] },
    initialize: {
        settings: { capacity: 1024 },
        blocks: [
            block('set-lifetime', { seconds: [1.2, 2] }),
            block('position-sphere', { center: [0, 0.3, 0], radius: 0.1 }),
            block('velocity-direction', { direction: [0, 1, 0], speed: [1, 2], spread: 20 }),
            block('set-size', { size: [0.06, 0.12] }),
        ],
    },
    update: { blocks: [block('drag', { amount: 0.6 })] },
    output: { blocks: [block('size-over-life', { start: 1, end: 0.2, curve: 1 }), block('fade', { in: 0.1, out: 0.4 })] },
};
