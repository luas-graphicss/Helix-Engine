import { clamp } from '@/engine/core/math/scalar';
import { ALL_AREAS_MASK, clampAreaMask } from '../areas/nav-areas';
export const NAV_AVOIDANCE_QUALITIES = ['none', 'low', 'medium', 'high'] as const;
export type NavAvoidanceQuality = (typeof NAV_AVOIDANCE_QUALITIES)[number];
export interface NavAgentSettings {
    speed: number;
    angularSpeed: number;
    acceleration: number;
    stoppingDistance: number;
    autoBraking: boolean;
    radius: number;
    height: number;
    baseOffset: number;
    avoidance: NavAvoidanceQuality;
    avoidancePriority: number;
    areaMask: number;
    target: number | null;
}
const AGENT_SCALAR_RANGE = {
    speed: [0, 50],
    angularSpeed: [0, 3600],
    acceleration: [0.1, 200],
    stoppingDistance: [0, 50],
    radius: [0.05, 5],
    height: [0.1, 20],
    baseOffset: [-10, 10],
    avoidancePriority: [0, 99],
} as const satisfies Partial<Record<keyof NavAgentSettings, readonly [number, number]>>;
export type NavAgentScalar = keyof typeof AGENT_SCALAR_RANGE;
const AGENT_SCALARS = Object.keys(AGENT_SCALAR_RANGE) as NavAgentScalar[];
export function createNavAgentSettings(overrides: Partial<NavAgentSettings> = {}): NavAgentSettings {
    return {
        speed: 3.5,
        angularSpeed: 360,
        acceleration: 8,
        stoppingDistance: 0.1,
        autoBraking: true,
        radius: 0.4,
        height: 1.8,
        baseOffset: 0,
        avoidance: 'medium',
        avoidancePriority: 50,
        areaMask: ALL_AREAS_MASK,
        target: null,
        ...overrides,
    };
}
export function cloneNavAgentSettings(settings: NavAgentSettings): NavAgentSettings {
    return { ...settings };
}
export function clampNavAgentScalar(key: NavAgentScalar, value: number): number {
    const [min, max] = AGENT_SCALAR_RANGE[key];
    const clamped = clamp(value, min, max);
    return key === 'avoidancePriority' ? Math.round(clamped) : clamped;
}
export function normalizeNavAgentSettings(settings: NavAgentSettings): NavAgentSettings {
    const normalized = createNavAgentSettings();
    for (const key of AGENT_SCALARS) {
        if (Number.isFinite(settings[key]))
            normalized[key] = clampNavAgentScalar(key, settings[key]);
    }
    if (typeof settings.autoBraking === 'boolean')
        normalized.autoBraking = settings.autoBraking;
    if (NAV_AVOIDANCE_QUALITIES.includes(settings.avoidance))
        normalized.avoidance = settings.avoidance;
    normalized.areaMask = clampAreaMask(settings.areaMask);
    normalized.target = typeof settings.target === 'number' && Number.isInteger(settings.target) ? settings.target : null;
    return normalized;
}
