export type BrushFalloff = 'smooth' | 'linear' | 'spherical' | 'tip' | 'flat';
export interface BrushSettings {
    radius: number;
    strength: number;
    falloff: BrushFalloff;
}
export const MIN_BRUSH_RADIUS = 0.25;
export const MAX_BRUSH_RADIUS = 200;
export const BRUSH_FALLOFFS: ReadonlyArray<{
    value: BrushFalloff;
    label: string;
    description: string;
}> = [
    { value: 'smooth', label: 'Suave', description: 'Transição em S, sem marcas na borda.' },
    { value: 'linear', label: 'Linear', description: 'Cai em linha reta do centro à borda.' },
    { value: 'spherical', label: 'Esférico', description: 'Cheio quase até a borda, ideal para cúpulas.' },
    { value: 'tip', label: 'Ponta', description: 'Concentrado no centro, para detalhes finos.' },
    { value: 'flat', label: 'Plano', description: 'Platô com borda macia.' },
];
export function createBrushSettings(overrides: Partial<BrushSettings> = {}): BrushSettings {
    return { radius: 8, strength: 0.5, falloff: 'smooth', ...overrides };
}
export function falloffWeight(t: number, falloff: BrushFalloff): number {
    if (t >= 1)
        return 0;
    if (t <= 0)
        return 1;
    switch (falloff) {
        case 'smooth':
            return 1 - t * t * (3 - 2 * t);
        case 'linear':
            return 1 - t;
        case 'spherical':
            return Math.sqrt(1 - t * t);
        case 'tip':
            return (1 - t) * (1 - t);
        case 'flat':
            return t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
    }
}
export function falloffHalfRadius(falloff: BrushFalloff): number {
    switch (falloff) {
        case 'smooth':
            return 0.5;
        case 'linear':
            return 0.5;
        case 'spherical':
            return 0.866;
        case 'tip':
            return 0.293;
        case 'flat':
            return 0.9;
    }
}
