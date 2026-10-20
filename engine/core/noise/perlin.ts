import { latticeHash, wrap } from './lattice-hash';
const GRADIENT_COUNT = 16;
const GRADIENTS = new Float32Array(GRADIENT_COUNT * 2);
for (let i = 0; i < GRADIENT_COUNT; i++) {
    const angle = (i / GRADIENT_COUNT) * Math.PI * 2;
    GRADIENTS[i * 2] = Math.cos(angle);
    GRADIENTS[i * 2 + 1] = Math.sin(angle);
}
function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}
function gradientDot(ix: number, iy: number, period: number, seed: number, dx: number, dy: number): number {
    const index = Math.floor(latticeHash(wrap(ix, period), wrap(iy, period), 0, seed) * GRADIENT_COUNT) * 2;
    return GRADIENTS[index] * dx + GRADIENTS[index + 1] * dy;
}
export function perlin2(x: number, y: number, period: number, seed: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fade(fx);
    const v = fade(fy);
    const n00 = gradientDot(x0, y0, period, seed, fx, fy);
    const n10 = gradientDot(x0 + 1, y0, period, seed, fx - 1, fy);
    const n01 = gradientDot(x0, y0 + 1, period, seed, fx, fy - 1);
    const n11 = gradientDot(x0 + 1, y0 + 1, period, seed, fx - 1, fy - 1);
    const nx0 = n00 + (n10 - n00) * u;
    const nx1 = n01 + (n11 - n01) * u;
    return (nx0 + (nx1 - nx0) * v) * 1.414;
}
export function perlinFbm2(x: number, y: number, period: number, octaves: number, seed: number): number {
    let sum = 0;
    let amplitude = 0.5;
    let total = 0;
    let frequency = 1;
    for (let octave = 0; octave < octaves; octave++) {
        sum += perlin2(x * frequency, y * frequency, period * frequency, seed + octave) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    const normalized = (sum / total) * 0.5 + 0.5;
    return Math.min(1, Math.max(0, (normalized - 0.5) * 1.9 + 0.5));
}
