import { clamp } from '@/engine/core/math/scalar';
export interface GerstnerWave {
    readonly angle: number;
    readonly lengthScale: number;
    readonly amplitudeScale: number;
}
export const GERSTNER_WAVES: readonly GerstnerWave[] = [
    { angle: 0, lengthScale: 1, amplitudeScale: 1 },
    { angle: 0.52, lengthScale: 0.62, amplitudeScale: 0.55 },
    { angle: -0.38, lengthScale: 0.41, amplitudeScale: 0.34 },
    { angle: 1.1, lengthScale: 0.27, amplitudeScale: 0.2 },
    { angle: -0.9, lengthScale: 0.17, amplitudeScale: 0.11 },
    { angle: 0.25, lengthScale: 0.11, amplitudeScale: 0.06 },
];
export const GERSTNER_AMPLITUDE_SUM = GERSTNER_WAVES.reduce((sum, wave) => sum + wave.amplitudeScale, 0);
export const WAVE_GRAVITY = 9.81;
export const MIN_WAVELENGTH = 0.2;
const METERS_PER_CELL = 1;
const MIN_SEGMENTS = 32;
const MAX_SEGMENTS = 320;
export function waterGridSegments(size: number): number {
    return clamp(Math.round(size / METERS_PER_CELL), MIN_SEGMENTS, MAX_SEGMENTS);
}
export function waterGridCell(size: number): number {
    return size / waterGridSegments(size);
}
export function waveResolvability(wavelength: number, cell: number): number {
    const t = clamp((wavelength - 2 * cell) / (2 * cell), 0, 1);
    return t * t * (3 - 2 * t);
}
function glslFloat(value: number): string {
    const text = String(value);
    return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}
export const GERSTNER_WAVES_GLSL = `
const float GRAVITY = ${glslFloat(WAVE_GRAVITY)};
const float MIN_WAVELENGTH = ${glslFloat(MIN_WAVELENGTH)};
const int WAVE_COUNT = ${GERSTNER_WAVES.length};

const vec3 WAVES[WAVE_COUNT] = vec3[](
${GERSTNER_WAVES.map((wave) => `  vec3(${glslFloat(wave.angle)}, ${glslFloat(wave.lengthScale)}, ${glslFloat(wave.amplitudeScale)})`).join(',\n')}
);

const float AMPLITUDE_SUM = ${glslFloat(Number(GERSTNER_AMPLITUDE_SUM.toFixed(6)))};
`;
