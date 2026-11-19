import { clamp } from '@/engine/core/math/scalar';
const CLOTH_ANCHORS = ['none', 'top', 'bottom', 'left', 'right', 'corners'] as const;
export type ClothAnchor = (typeof CLOTH_ANCHORS)[number];
const CLOTH_QUALITIES = ['low', 'medium', 'high'] as const;
export type ClothQuality = (typeof CLOTH_QUALITIES)[number];
export interface ClothSettings {
    anchor: ClothAnchor;
    anchorBand: number;
    quality: ClothQuality;
    density: number;
    stretchStiffness: number;
    bendStiffness: number;
    damping: number;
    gravityScale: number;
    windSpeed: number;
    windDirection: number;
    windTurbulence: number;
    airDrag: number;
    collideWithBodies: boolean;
    thickness: number;
    friction: number;
}
const CLOTH_SCALAR_RANGE = {
    anchorBand: [0, 0.5],
    density: [0.05, 5],
    stretchStiffness: [0, 1],
    bendStiffness: [0, 1],
    damping: [0, 1],
    gravityScale: [-2, 4],
    windSpeed: [0, 40],
    windDirection: [0, 360],
    windTurbulence: [0, 1],
    airDrag: [0, 4],
    thickness: [0.002, 0.5],
    friction: [0, 1],
} as const satisfies Partial<Record<keyof ClothSettings, readonly [number, number]>>;
export type ClothScalar = keyof typeof CLOTH_SCALAR_RANGE;
const CLOTH_SCALARS = Object.keys(CLOTH_SCALAR_RANGE) as ClothScalar[];
export function createClothSettings(overrides: Partial<ClothSettings> = {}): ClothSettings {
    return {
        anchor: 'none',
        anchorBand: 0,
        quality: 'medium',
        density: 0.25,
        stretchStiffness: 0.9,
        bendStiffness: 0.2,
        damping: 0.15,
        gravityScale: 1,
        windSpeed: 0,
        windDirection: 0,
        windTurbulence: 0.35,
        airDrag: 1,
        collideWithBodies: true,
        thickness: 0.02,
        friction: 0.4,
        ...overrides,
    };
}
export function cloneClothSettings(settings: ClothSettings): ClothSettings {
    return { ...settings };
}
export function clampClothScalar(key: ClothScalar, value: number): number {
    const [min, max] = CLOTH_SCALAR_RANGE[key];
    return clamp(value, min, max);
}
export function normalizeClothSettings(settings: ClothSettings): ClothSettings {
    const defaults = createClothSettings();
    const normalized = cloneClothSettings(settings);
    if (!CLOTH_ANCHORS.includes(normalized.anchor))
        normalized.anchor = defaults.anchor;
    if (!CLOTH_QUALITIES.includes(normalized.quality))
        normalized.quality = defaults.quality;
    if (typeof normalized.collideWithBodies !== 'boolean')
        normalized.collideWithBodies = defaults.collideWithBodies;
    for (const key of CLOTH_SCALARS)
        normalized[key] = Number.isFinite(normalized[key]) ? clampClothScalar(key, normalized[key]) : defaults[key];
    return normalized;
}
