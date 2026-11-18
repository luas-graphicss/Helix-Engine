export type GizmoTool = 'translate' | 'rotate' | 'scale' | 'transform' | 'universal' | 'rect';
export type TransformSpace = 'global' | 'local';
export type PivotMode = 'pivot' | 'center';
export const SNAP_TARGETS = ['increment', 'grid', 'vertex', 'surface'] as const;
export type SnapTarget = (typeof SNAP_TARGETS)[number];
export function isSnapTarget(value: unknown): value is SnapTarget {
    return SNAP_TARGETS.some((target) => target === value);
}
