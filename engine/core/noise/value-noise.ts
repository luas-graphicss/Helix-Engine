import { latticeHash } from './lattice-hash';
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}
export function valueNoise3(x: number, y: number, z: number, seed: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const u = smoothstep(x - x0);
    const v = smoothstep(y - y0);
    const w = smoothstep(z - z0);
    const c000 = latticeHash(x0, y0, z0, seed);
    const c100 = latticeHash(x0 + 1, y0, z0, seed);
    const c010 = latticeHash(x0, y0 + 1, z0, seed);
    const c110 = latticeHash(x0 + 1, y0 + 1, z0, seed);
    const c001 = latticeHash(x0, y0, z0 + 1, seed);
    const c101 = latticeHash(x0 + 1, y0, z0 + 1, seed);
    const c011 = latticeHash(x0, y0 + 1, z0 + 1, seed);
    const c111 = latticeHash(x0 + 1, y0 + 1, z0 + 1, seed);
    const x00 = c000 + (c100 - c000) * u;
    const x10 = c010 + (c110 - c010) * u;
    const x01 = c001 + (c101 - c001) * u;
    const x11 = c011 + (c111 - c011) * u;
    const y0v = x00 + (x10 - x00) * v;
    const y1v = x01 + (x11 - x01) * v;
    return (y0v + (y1v - y0v) * w) * 2 - 1;
}
export function fbm3(x: number, y: number, z: number, octaves: number, seed: number, gain = 0.5): number {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let frequency = 1;
    for (let octave = 0; octave < octaves; octave++) {
        sum += valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave) * amplitude;
        total += amplitude;
        amplitude *= gain;
        frequency *= 2;
    }
    return sum / total;
}
export function ridgedFbm3(x: number, y: number, z: number, octaves: number, seed: number): number {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let frequency = 1;
    for (let octave = 0; octave < octaves; octave++) {
        const ridge = 1 - Math.abs(valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave));
        sum += ridge * ridge * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return sum / total;
}
