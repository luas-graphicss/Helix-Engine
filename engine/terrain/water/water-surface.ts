import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import { GERSTNER_AMPLITUDE_SUM, GERSTNER_WAVES, MIN_WAVELENGTH, waterGridCell, waveResolvability, WAVE_GRAVITY } from './gerstner-waves';
import type { WaterSettings } from './water-settings';
export interface WaterSample {
    height: number;
    readonly velocity: Vec3;
    readonly normal: Vec3;
}
export function createWaterSample(): WaterSample {
    return { height: 0, velocity: vec3.create(), normal: vec3.create(0, 1, 0) };
}
interface ResolvedWave {
    dirX: number;
    dirZ: number;
    k: number;
    amplitude: number;
    q: number;
    phaseRate: number;
}
export class WaveSpectrum {
    private readonly waves: ResolvedWave[] = GERSTNER_WAVES.map(() => ({ dirX: 1, dirZ: 0, k: 1, amplitude: 0, q: 0, phaseRate: 0 }));
    private count = 0;
    private level = 0;
    private choppy = false;
    get hasWaves(): boolean {
        return this.count > 0;
    }
    prepare(water: WaterSettings, terrainSize: number): this {
        this.level = water.level;
        this.count = 0;
        const totalAmplitude = Math.max(water.waveHeight, 0) * 0.5;
        if (totalAmplitude <= 1e-4)
            return this;
        const mainLength = Math.max(water.waveLength, 0.5);
        const choppiness = clamp(water.choppiness, 0, 1);
        this.choppy = choppiness > 1e-4;
        const cell = waterGridCell(terrainSize);
        const direction = degToRad(water.waveDirection);
        const mainX = Math.cos(direction);
        const mainZ = Math.sin(direction);
        for (const wave of GERSTNER_WAVES) {
            const wavelength = Math.max(mainLength * wave.lengthScale, MIN_WAVELENGTH);
            const amplitude = ((totalAmplitude * wave.amplitudeScale) / GERSTNER_AMPLITUDE_SUM) * waveResolvability(wavelength, cell);
            if (amplitude <= 1e-6)
                continue;
            const c = Math.cos(wave.angle);
            const s = Math.sin(wave.angle);
            const k = TWO_PI / wavelength;
            const resolved = this.waves[this.count++];
            resolved.dirX = c * mainX - s * mainZ;
            resolved.dirZ = s * mainX + c * mainZ;
            resolved.k = k;
            resolved.amplitude = amplitude;
            resolved.q = choppiness / (k * amplitude * GERSTNER_WAVES.length);
            resolved.phaseRate = Math.sqrt(WAVE_GRAVITY * k) * water.waveSpeed;
        }
        return this;
    }
    invertDisplacement(out: Vec3, x: number, z: number, time: number): Vec3 {
        out[0] = 0;
        out[2] = 0;
        if (!this.choppy)
            return out;
        let px = x;
        let pz = z;
        for (let iteration = 0; iteration < INVERSION_ITERATIONS; iteration++) {
            let offsetX = 0;
            let offsetZ = 0;
            for (let i = 0; i < this.count; i++) {
                const wave = this.waves[i];
                const cosPhase = Math.cos(wave.k * (wave.dirX * px + wave.dirZ * pz) - wave.phaseRate * time);
                offsetX += wave.q * wave.amplitude * wave.dirX * cosPhase;
                offsetZ += wave.q * wave.amplitude * wave.dirZ * cosPhase;
            }
            px = x - offsetX;
            pz = z - offsetZ;
        }
        out[0] = px - x;
        out[2] = pz - z;
        return out;
    }
    sample(out: WaterSample, x: number, z: number, time: number, displacement: Vec3): WaterSample {
        const velocity = out.velocity;
        vec3.set(velocity, 0, 0, 0);
        if (this.count === 0) {
            out.height = this.level;
            vec3.set(out.normal, 0, 1, 0);
            return out;
        }
        const px = x + displacement[0];
        const pz = z + displacement[2];
        let height = this.level;
        vec3.set(tangent, 1, 0, 0);
        vec3.set(binormal, 0, 0, 1);
        for (let i = 0; i < this.count; i++) {
            const wave = this.waves[i];
            const { dirX, dirZ, q, amplitude } = wave;
            const phase = wave.k * (dirX * px + dirZ * pz) - wave.phaseRate * time;
            const sinPhase = Math.sin(phase);
            const cosPhase = Math.cos(phase);
            height += amplitude * sinPhase;
            const rate = amplitude * wave.phaseRate;
            velocity[0] += q * dirX * rate * sinPhase;
            velocity[1] -= rate * cosPhase;
            velocity[2] += q * dirZ * rate * sinPhase;
            const ka = wave.k * amplitude;
            tangent[0] -= q * dirX * dirX * ka * sinPhase;
            tangent[1] += dirX * ka * cosPhase;
            tangent[2] -= q * dirX * dirZ * ka * sinPhase;
            binormal[0] -= q * dirX * dirZ * ka * sinPhase;
            binormal[1] += dirZ * ka * cosPhase;
            binormal[2] -= q * dirZ * dirZ * ka * sinPhase;
        }
        out.height = height;
        vec3.cross(out.normal, binormal, tangent);
        vec3.normalize(out.normal, out.normal);
        return out;
    }
}
const INVERSION_ITERATIONS = 3;
const TWO_PI = 2 * Math.PI;
const tangent = vec3.create();
const binormal = vec3.create();
const sharedSpectrum = new WaveSpectrum();
const sharedDisplacement = vec3.create();
export function sampleWaterSurface(out: WaterSample, water: WaterSettings, terrainSize: number, x: number, z: number, elapsedSeconds: number): WaterSample {
    const spectrum = sharedSpectrum.prepare(water, terrainSize);
    spectrum.invertDisplacement(sharedDisplacement, x, z, elapsedSeconds);
    return spectrum.sample(out, x, z, elapsedSeconds, sharedDisplacement);
}
