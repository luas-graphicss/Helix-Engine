import { clamp, lerp } from '@/engine/core/math/scalar';
export type VfxCurveInterpolation = 'linear' | 'smooth' | 'step';
export interface VfxCurveKey {
    readonly t: number;
    readonly v: number;
}
export interface VfxCurve {
    readonly keys: readonly VfxCurveKey[];
    readonly interpolation: VfxCurveInterpolation;
}
export type VfxRgb = readonly [
    number,
    number,
    number
];
export interface VfxColorStop {
    readonly t: number;
    readonly color: VfxRgb;
}
export interface VfxAlphaStop {
    readonly t: number;
    readonly alpha: number;
}
export interface VfxGradient {
    readonly colors: readonly VfxColorStop[];
    readonly alphas: readonly VfxAlphaStop[];
}
export type VfxScalar = {
    readonly kind: 'constant';
    readonly value: number;
} | {
    readonly kind: 'random';
    readonly min: number;
    readonly max: number;
} | {
    readonly kind: 'curve';
    readonly curve: VfxCurve;
    readonly scale: number;
} | {
    readonly kind: 'randomCurve';
    readonly min: VfxCurve;
    readonly max: VfxCurve;
    readonly scale: number;
};
export type VfxScalarKind = VfxScalar['kind'];
export const VFX_SCALAR_KIND_LABEL: Record<VfxScalarKind, string> = {
    constant: 'Constante',
    random: 'Aleatório entre dois',
    curve: 'Curva',
    randomCurve: 'Aleatório entre curvas',
};
export type VfxColorValue = {
    readonly kind: 'constant';
    readonly color: VfxRgb;
    readonly alpha: number;
} | {
    readonly kind: 'random';
    readonly a: VfxRgb;
    readonly alphaA: number;
    readonly b: VfxRgb;
    readonly alphaB: number;
} | {
    readonly kind: 'gradient';
    readonly gradient: VfxGradient;
};
export type VfxColorKind = VfxColorValue['kind'];
export const VFX_COLOR_KIND_LABEL: Record<VfxColorKind, string> = {
    constant: 'Cor fixa',
    random: 'Aleatória entre duas',
    gradient: 'Gradiente no tempo',
};
export function createCurve(keys: readonly VfxCurveKey[], interpolation: VfxCurveInterpolation = 'smooth'): VfxCurve {
    const sorted = [...keys].map((key) => ({ t: clamp(key.t, 0, 1), v: key.v })).sort((a, b) => a.t - b.t);
    return { keys: sorted.length > 0 ? sorted : [{ t: 0, v: 1 }], interpolation };
}
export function constantCurve(value: number): VfxCurve {
    return { keys: [{ t: 0, v: value }], interpolation: 'linear' };
}
export function linearCurve(from: number, to: number): VfxCurve {
    return { keys: [{ t: 0, v: from }, { t: 1, v: to }], interpolation: 'linear' };
}
export function bellCurve(edges: number, peak: number, peakAt = 0.5): VfxCurve {
    return { keys: [{ t: 0, v: edges }, { t: clamp(peakAt, 0.01, 0.99), v: peak }, { t: 1, v: edges }], interpolation: 'smooth' };
}
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}
export function sampleCurve(curve: VfxCurve, t: number): number {
    const { keys } = curve;
    const count = keys.length;
    if (count === 0)
        return 0;
    if (count === 1 || t <= keys[0].t)
        return keys[0].v;
    const last = keys[count - 1];
    if (t >= last.t)
        return last.v;
    let index = 1;
    while (index < count - 1 && keys[index].t < t)
        index++;
    const a = keys[index - 1];
    const b = keys[index];
    const span = b.t - a.t;
    if (span <= 1e-6)
        return b.v;
    const local = (t - a.t) / span;
    switch (curve.interpolation) {
        case 'step':
            return a.v;
        case 'linear':
            return lerp(a.v, b.v, local);
        default:
            return lerp(a.v, b.v, smoothstep(local));
    }
}
export function curveRange(curve: VfxCurve): {
    min: number;
    max: number;
} {
    let min = Infinity;
    let max = -Infinity;
    for (const key of curve.keys) {
        if (key.v < min)
            min = key.v;
        if (key.v > max)
            max = key.v;
    }
    return { min, max };
}
export function setCurveKey(curve: VfxCurve, index: number, key: VfxCurveKey): VfxCurve {
    const keys = curve.keys.map((current, i) => (i === index ? { t: clamp(key.t, 0, 1), v: key.v } : current));
    return { ...curve, keys: keys.sort((a, b) => a.t - b.t) };
}
export function addCurveKey(curve: VfxCurve, key: VfxCurveKey): VfxCurve {
    return createCurve([...curve.keys, key], curve.interpolation);
}
export function removeCurveKey(curve: VfxCurve, index: number): VfxCurve {
    if (curve.keys.length <= 1)
        return curve;
    return { ...curve, keys: curve.keys.filter((_, i) => i !== index) };
}
export function createGradient(colors: readonly VfxColorStop[], alphas: readonly VfxAlphaStop[]): VfxGradient {
    const sortedColors = [...colors].map((stop) => ({ t: clamp(stop.t, 0, 1), color: stop.color })).sort((a, b) => a.t - b.t);
    const sortedAlphas = [...alphas].map((stop) => ({ t: clamp(stop.t, 0, 1), alpha: clamp(stop.alpha, 0, 1) })).sort((a, b) => a.t - b.t);
    return {
        colors: sortedColors.length > 0 ? sortedColors : [{ t: 0, color: [1, 1, 1] }],
        alphas: sortedAlphas.length > 0 ? sortedAlphas : [{ t: 0, alpha: 1 }],
    };
}
export function solidGradient(color: VfxRgb, alpha = 1): VfxGradient {
    return { colors: [{ t: 0, color }], alphas: [{ t: 0, alpha }] };
}
export function fadeInOutGradient(color: VfxRgb, peakAlpha = 1, fadeIn = 0.15, fadeOut = 0.6): VfxGradient {
    return {
        colors: [{ t: 0, color }],
        alphas: [
            { t: 0, alpha: 0 },
            { t: clamp(fadeIn, 0.01, 0.98), alpha: peakAlpha },
            { t: clamp(fadeOut, fadeIn + 0.01, 0.99), alpha: peakAlpha },
            { t: 1, alpha: 0 },
        ],
    };
}
export function sampleGradient(gradient: VfxGradient, t: number, out: Float32Array, offset = 0): void {
    const { colors, alphas } = gradient;
    if (colors.length === 1 || t <= colors[0].t) {
        const [r, g, b] = colors[0].color;
        out[offset] = r;
        out[offset + 1] = g;
        out[offset + 2] = b;
    }
    else if (t >= colors[colors.length - 1].t) {
        const [r, g, b] = colors[colors.length - 1].color;
        out[offset] = r;
        out[offset + 1] = g;
        out[offset + 2] = b;
    }
    else {
        let index = 1;
        while (index < colors.length - 1 && colors[index].t < t)
            index++;
        const a = colors[index - 1];
        const b = colors[index];
        const span = b.t - a.t;
        const local = span <= 1e-6 ? 1 : (t - a.t) / span;
        out[offset] = lerp(a.color[0], b.color[0], local);
        out[offset + 1] = lerp(a.color[1], b.color[1], local);
        out[offset + 2] = lerp(a.color[2], b.color[2], local);
    }
    if (alphas.length === 1 || t <= alphas[0].t) {
        out[offset + 3] = alphas[0].alpha;
    }
    else if (t >= alphas[alphas.length - 1].t) {
        out[offset + 3] = alphas[alphas.length - 1].alpha;
    }
    else {
        let index = 1;
        while (index < alphas.length - 1 && alphas[index].t < t)
            index++;
        const a = alphas[index - 1];
        const b = alphas[index];
        const span = b.t - a.t;
        const local = span <= 1e-6 ? 1 : (t - a.t) / span;
        out[offset + 3] = lerp(a.alpha, b.alpha, local);
    }
}
export function gradientToCss(gradient: VfxGradient, angle = 90): string {
    const times = new Set<number>();
    for (const stop of gradient.colors)
        times.add(stop.t);
    for (const stop of gradient.alphas)
        times.add(stop.t);
    times.add(0);
    times.add(1);
    const sample = new Float32Array(4);
    const stops = [...times]
        .sort((a, b) => a - b)
        .map((t) => {
        sampleGradient(gradient, t, sample);
        const r = Math.round(clamp(sample[0], 0, 1) * 255);
        const g = Math.round(clamp(sample[1], 0, 1) * 255);
        const b = Math.round(clamp(sample[2], 0, 1) * 255);
        return `rgba(${r}, ${g}, ${b}, ${sample[3].toFixed(3)}) ${(t * 100).toFixed(1)}%`;
    });
    return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}
export function scalarConstant(value: number): VfxScalar {
    return { kind: 'constant', value };
}
export function scalarRandom(min: number, max: number): VfxScalar {
    return { kind: 'random', min: Math.min(min, max), max: Math.max(min, max) };
}
export function scalarCurve(curve: VfxCurve, scale = 1): VfxScalar {
    return { kind: 'curve', curve, scale };
}
export function scalarRandomCurve(min: VfxCurve, max: VfxCurve, scale = 1): VfxScalar {
    return { kind: 'randomCurve', min, max, scale };
}
export function sampleScalar(scalar: VfxScalar, t: number, random: number): number {
    switch (scalar.kind) {
        case 'constant':
            return scalar.value;
        case 'random':
            return lerp(scalar.min, scalar.max, random);
        case 'curve':
            return sampleCurve(scalar.curve, t) * scalar.scale;
        default:
            return lerp(sampleCurve(scalar.min, t), sampleCurve(scalar.max, t), random) * scalar.scale;
    }
}
export function scalarPeak(scalar: VfxScalar): number {
    switch (scalar.kind) {
        case 'constant':
            return Math.abs(scalar.value);
        case 'random':
            return Math.max(Math.abs(scalar.min), Math.abs(scalar.max));
        case 'curve': {
            const range = curveRange(scalar.curve);
            return Math.max(Math.abs(range.min), Math.abs(range.max)) * Math.abs(scalar.scale);
        }
        default: {
            const a = curveRange(scalar.min);
            const b = curveRange(scalar.max);
            return Math.max(Math.abs(a.min), Math.abs(a.max), Math.abs(b.min), Math.abs(b.max)) * Math.abs(scalar.scale);
        }
    }
}
export function scalarAverage(scalar: VfxScalar): number {
    switch (scalar.kind) {
        case 'constant':
            return scalar.value;
        case 'random':
            return (scalar.min + scalar.max) / 2;
        case 'curve': {
            const range = curveRange(scalar.curve);
            return ((range.min + range.max) / 2) * scalar.scale;
        }
        default: {
            const a = curveRange(scalar.min);
            const b = curveRange(scalar.max);
            return ((a.min + a.max + b.min + b.max) / 4) * scalar.scale;
        }
    }
}
export function convertScalar(scalar: VfxScalar, kind: VfxScalarKind): VfxScalar {
    if (scalar.kind === kind)
        return scalar;
    const average = scalarAverage(scalar);
    const spread = Math.abs(average) * 0.25;
    switch (kind) {
        case 'constant':
            return scalarConstant(average);
        case 'random':
            return scalar.kind === 'randomCurve'
                ? scalarRandom(scalarAverage(scalarCurve(scalar.min, scalar.scale)), scalarAverage(scalarCurve(scalar.max, scalar.scale)))
                : scalarRandom(average - spread, average + spread);
        case 'curve':
            if (scalar.kind === 'randomCurve')
                return scalarCurve(scalar.min, scalar.scale);
            return scalarCurve(constantCurve(1), average);
        default:
            if (scalar.kind === 'curve')
                return scalarRandomCurve(scalar.curve, scalar.curve, scalar.scale);
            if (scalar.kind === 'random')
                return scalarRandomCurve(constantCurve(scalar.min), constantCurve(scalar.max), 1);
            return scalarRandomCurve(constantCurve(0.75), constantCurve(1.25), average);
    }
}
export function colorConstant(color: VfxRgb, alpha = 1): VfxColorValue {
    return { kind: 'constant', color, alpha };
}
export function colorRandom(a: VfxRgb, b: VfxRgb, alphaA = 1, alphaB = 1): VfxColorValue {
    return { kind: 'random', a, alphaA, b, alphaB };
}
export function colorGradient(gradient: VfxGradient): VfxColorValue {
    return { kind: 'gradient', gradient };
}
export function sampleColorValue(value: VfxColorValue, t: number, random: number, out: Float32Array, offset = 0): void {
    switch (value.kind) {
        case 'constant':
            out[offset] = value.color[0];
            out[offset + 1] = value.color[1];
            out[offset + 2] = value.color[2];
            out[offset + 3] = value.alpha;
            return;
        case 'random':
            out[offset] = lerp(value.a[0], value.b[0], random);
            out[offset + 1] = lerp(value.a[1], value.b[1], random);
            out[offset + 2] = lerp(value.a[2], value.b[2], random);
            out[offset + 3] = lerp(value.alphaA, value.alphaB, random);
            return;
        default:
            sampleGradient(value.gradient, t, out, offset);
    }
}
export function colorValueSwatch(value: VfxColorValue): VfxRgb {
    switch (value.kind) {
        case 'constant':
            return value.color;
        case 'random':
            return [(value.a[0] + value.b[0]) / 2, (value.a[1] + value.b[1]) / 2, (value.a[2] + value.b[2]) / 2];
        default: {
            const sample = new Float32Array(4);
            sampleGradient(value.gradient, 0.5, sample);
            return [sample[0], sample[1], sample[2]];
        }
    }
}
export function convertColorValue(value: VfxColorValue, kind: VfxColorKind): VfxColorValue {
    if (value.kind === kind)
        return value;
    const swatch = colorValueSwatch(value);
    const alpha = value.kind === 'constant' ? value.alpha : value.kind === 'random' ? (value.alphaA + value.alphaB) / 2 : 1;
    switch (kind) {
        case 'constant':
            return colorConstant(swatch, alpha);
        case 'random':
            return colorRandom(swatch, [clamp(swatch[0] * 0.7, 0, 1), clamp(swatch[1] * 0.7, 0, 1), clamp(swatch[2] * 0.7, 0, 1)], alpha, alpha);
        default:
            return colorGradient(solidGradient(swatch, alpha));
    }
}
export function rgbToHex(color: VfxRgb): string {
    return `#${color.map((channel) => Math.round(clamp(channel, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
}
export function hexToRgb(hex: string): VfxRgb | null {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match)
        return null;
    const value = Number.parseInt(match[1], 16);
    return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}
