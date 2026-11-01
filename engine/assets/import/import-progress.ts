export type ImportProgressReporter = (fraction: number, stage: string) => void;
export const IGNORE_PROGRESS: ImportProgressReporter = () => undefined;
export const STAGE_READING = 'Lendo arquivo';
export const STAGE_TEXTURES = 'Resolvendo texturas';
export const STAGE_GEOMETRY = 'Convertendo geometria';
export const STAGE_NORMALS = 'Calculando normais';
export const STAGE_HIERARCHY = 'Montando hierarquia';
export function progressBetween(from: number, to: number, done: number, total: number): number {
    if (total <= 0)
        return to;
    return from + (to - from) * Math.min(1, Math.max(0, done / total));
}
