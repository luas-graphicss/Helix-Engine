import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { CsgOperation } from './csg-boolean';
export type { CsgOperation } from './csg-boolean';
export type CsgBrushShape = 'box' | 'cylinder' | 'sphere' | 'capsule' | 'cone' | 'torus';
export interface CsgBrushSettings {
    operation: CsgOperation;
    enabled: boolean;
}
export type CsgPrecision = 'fast' | 'exact';
export interface CsgSettings {
    live: boolean;
    readonly sourceMesh: MeshData;
    showBrushes: boolean;
    precision: CsgPrecision;
}
export const CSG_PRECISION_LABEL: Record<CsgPrecision, string> = {
    fast: 'Rápida',
    exact: 'Exata',
};
export const CSG_OPERATIONS: readonly CsgOperation[] = ['subtract', 'union', 'intersect'];
export const CSG_OPERATION_LABEL: Record<CsgOperation, string> = {
    subtract: 'Subtrair',
    union: 'Unir',
    intersect: 'Interseção',
};
export const CSG_SHAPE_LABEL: Record<CsgBrushShape, string> = {
    box: 'Caixa',
    cylinder: 'Cilindro',
    sphere: 'Esfera',
    capsule: 'Cápsula',
    cone: 'Cone',
    torus: 'Toro',
};
export function createCsgSettings(sourceMesh: MeshData, overrides: Partial<Omit<CsgSettings, 'sourceMesh'>> = {}): CsgSettings {
    return { live: true, showBrushes: true, precision: 'fast', ...overrides, sourceMesh };
}
export function createCsgBrushSettings(operation: CsgOperation = 'subtract', enabled = true): CsgBrushSettings {
    return { operation, enabled };
}
export function cloneCsgSettings(settings: CsgSettings): CsgSettings {
    return { ...settings };
}
export function cloneCsgBrushSettings(settings: CsgBrushSettings): CsgBrushSettings {
    return { ...settings };
}
