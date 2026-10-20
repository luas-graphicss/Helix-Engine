import { perlin2 } from '@/engine/core/noise/perlin';
import { clamp } from '@/engine/core/math/scalar';
import type { Heightfield } from '@/engine/terrain/core/heightfield';
import { erodeThermal } from '@/engine/terrain/sculpt/sculpt-tools';
export type TerrainPreset = 'flat' | 'hills' | 'mountains' | 'valley' | 'islands' | 'plateau' | 'dunes';
export interface TerrainGenerationParams {
    preset: TerrainPreset;
    seed: number;
    amplitude: number;
    featureSize: number;
    detail: number;
    erosion: number;
}
export const TERRAIN_PRESETS: ReadonlyArray<{
    value: TerrainPreset;
    label: string;
    description: string;
}> = [
    { value: 'flat', label: 'Plano', description: 'Superfície nivelada para começar do zero.' },
    { value: 'hills', label: 'Colinas', description: 'Ondulações suaves e campos abertos.' },
    { value: 'mountains', label: 'Montanhas', description: 'Cristas afiadas com vales profundos.' },
    { value: 'valley', label: 'Vale', description: 'Um vale de rio sinuoso entre encostas.' },
    { value: 'islands', label: 'Ilhas', description: 'Relevo que afunda nas bordas do terreno.' },
    { value: 'plateau', label: 'Platôs', description: 'Mesas e terraços escalonados.' },
    { value: 'dunes', label: 'Dunas', description: 'Cristas de areia alongadas pelo vento.' },
];
export function createGenerationParams(overrides: Partial<TerrainGenerationParams> = {}): TerrainGenerationParams {
    return { preset: 'hills', seed: 1337, amplitude: 24, featureSize: 90, detail: 0.5, erosion: 0, ...overrides };
}
const PERIOD = 1 << 20;
function fbm(x: number, y: number, octaves: number, seed: number, gain = 0.5, lacunarity = 2): number {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let frequency = 1;
    for (let octave = 0; octave < octaves; octave++) {
        sum += perlin2(x * frequency, y * frequency, PERIOD, seed + octave * 17) * amplitude;
        total += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return sum / total;
}
function ridged(x: number, y: number, octaves: number, seed: number): number {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let frequency = 1;
    let weight = 1;
    for (let octave = 0; octave < octaves; octave++) {
        let n = 1 - Math.abs(perlin2(x * frequency, y * frequency, PERIOD, seed + octave * 23));
        n = n * n * weight;
        weight = clamp(n * 2, 0, 1);
        sum += n * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2.1;
    }
    return sum / total;
}
function smoothstep(edge0: number, edge1: number, value: number): number {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}
type PresetSampler = (u: number, v: number, nx: number, ny: number, params: TerrainGenerationParams, octaves: number) => number;
const PRESETS: Record<TerrainPreset, PresetSampler> = {
    flat: () => 0,
    hills: (_u, _v, nx, ny, params, octaves) => fbm(nx, ny, octaves, params.seed) * 0.5 + 0.35,
    mountains: (_u, _v, nx, ny, params, octaves) => {
        const warpX = fbm(nx * 0.7 + 31, ny * 0.7, 2, params.seed + 5) * 0.6;
        const warpY = fbm(nx * 0.7, ny * 0.7 + 17, 2, params.seed + 9) * 0.6;
        const peaks = ridged(nx + warpX, ny + warpY, octaves, params.seed);
        const base = fbm(nx * 0.5, ny * 0.5, 3, params.seed + 3) * 0.25;
        return peaks * 0.9 + base + 0.1;
    },
    valley: (u, _v, nx, ny, params, octaves) => {
        const meander = fbm(ny * 0.6, 7.3, 2, params.seed + 41) * 0.25;
        const distance = Math.abs(u - 0.5 - meander);
        const walls = smoothstep(0.06, 0.42, distance);
        const relief = fbm(nx, ny, octaves, params.seed) * 0.35;
        return walls * 0.75 + relief * (0.4 + walls) + 0.05;
    },
    islands: (u, v, nx, ny, params, octaves) => {
        const radial = Math.hypot(u - 0.5, v - 0.5) * 2;
        const edge = 1 - smoothstep(0.45, 1.0, radial);
        const relief = fbm(nx, ny, octaves, params.seed) * 0.5 + 0.5;
        return relief * edge * 1.1 - 0.25;
    },
    plateau: (_u, _v, nx, ny, params, octaves) => {
        const base = fbm(nx, ny, octaves, params.seed) * 0.5 + 0.5;
        const steps = 4;
        const stepped = Math.floor(base * steps) / steps;
        const within = base * steps - Math.floor(base * steps);
        const edge = smoothstep(0.7, 1.0, within) / steps;
        return (stepped + edge) * 0.9 + fbm(nx * 4, ny * 4, 2, params.seed + 7) * 0.03;
    },
    dunes: (_u, _v, nx, ny, params, octaves) => {
        const drift = fbm(nx * 0.5, ny * 0.5, 2, params.seed + 2) * 0.8;
        const crest = 1 - Math.abs(Math.sin((nx * 0.9 + ny * 0.35 + drift) * Math.PI));
        const ripples = fbm(nx * 3, ny * 3, Math.max(octaves - 2, 1), params.seed + 4) * 0.08;
        return crest * crest * 0.75 + ripples + 0.1;
    },
};
export function generateTerrainHeights(heightfield: Heightfield, size: number, params: TerrainGenerationParams): void {
    const { resolution, heights } = heightfield;
    const sampler = PRESETS[params.preset];
    const octaves = 3 + Math.round(clamp(params.detail, 0, 1) * 4);
    const cycles = size / Math.max(params.featureSize, 1);
    const offset = params.seed * 0.137;
    for (let z = 0; z < resolution; z++) {
        const v = z / (resolution - 1);
        for (let x = 0; x < resolution; x++) {
            const u = x / (resolution - 1);
            heights[z * resolution + x] = sampler(u, v, u * cycles + offset, v * cycles + offset, params, octaves) * params.amplitude;
        }
    }
    if (params.erosion > 0) {
        const region = { x0: 0, z0: 0, x1: resolution - 1, z1: resolution - 1 };
        const cellSize = size / (resolution - 1);
        for (let pass = 0; pass < params.erosion; pass++)
            erodeThermal(heightfield, region, cellSize, 0.9, 0.35);
    }
}
