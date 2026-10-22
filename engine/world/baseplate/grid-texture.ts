import { createTexture, type Texture } from '@/engine/core/scene/texture';
export const GRID_TILE_METERS = 4;
const GRID_RESOLUTION = 1024;
interface GridTier {
    spacing: number;
    halfWidth: number;
    color: readonly [
        number,
        number,
        number
    ];
}
const GRID_TIERS: readonly GridTier[] = [
    { spacing: 1, halfWidth: 1.5, color: [104, 106, 111] },
    { spacing: GRID_TILE_METERS, halfWidth: 2.5, color: [84, 86, 92] },
];
const BASE_COLOR: readonly [
    number,
    number,
    number
] = [140, 142, 147];
const CHECKER_SHIFT = 4;
function distanceToLine(p: number, spacingPx: number): number {
    const m = p % spacingPx;
    return Math.min(m, spacingPx - m);
}
export function createGridTexture(): Texture {
    const size = GRID_RESOLUTION;
    const pixelsPerMeter = size / GRID_TILE_METERS;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
        const py = y + 0.5;
        const cellY = Math.floor(py / pixelsPerMeter);
        for (let x = 0; x < size; x++) {
            const px = x + 0.5;
            const cellX = Math.floor(px / pixelsPerMeter);
            const checker = (cellX + cellY) % 2 === 0 ? CHECKER_SHIFT : -CHECKER_SHIFT;
            let r = BASE_COLOR[0] + checker;
            let g = BASE_COLOR[1] + checker;
            let b = BASE_COLOR[2] + checker;
            for (const tier of GRID_TIERS) {
                const spacingPx = tier.spacing * pixelsPerMeter;
                const distance = Math.min(distanceToLine(px, spacingPx), distanceToLine(py, spacingPx));
                const coverage = Math.min(Math.max(tier.halfWidth + 0.5 - distance, 0), 1);
                if (coverage <= 0)
                    continue;
                r += (tier.color[0] - r) * coverage;
                g += (tier.color[1] - g) * coverage;
                b += (tier.color[2] - b) * coverage;
            }
            const offset = (y * size + x) * 4;
            data[offset] = r;
            data[offset + 1] = g;
            data[offset + 2] = b;
            data[offset + 3] = 255;
        }
    }
    return createTexture({
        name: 'Helix · Grade',
        image: new ImageData(data, size, size),
        colorSpace: 'srgb',
        wrapS: 'repeat',
        wrapT: 'repeat',
        sourcePath: 'engine/baseplate/grid',
    });
}
