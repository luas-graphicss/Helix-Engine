import { Box, Circle, Cone, Cylinder, Pill, Torus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CsgBrushShape, CsgOperation } from '@/engine/geometry/csg/csg-settings';
export const CSG_SHAPE_ICON: Record<CsgBrushShape, LucideIcon> = {
    box: Box,
    cylinder: Cylinder,
    sphere: Circle,
    capsule: Pill,
    cone: Cone,
    torus: Torus,
};
export const CSG_BRUSH_SHAPES: readonly CsgBrushShape[] = ['box', 'cylinder', 'sphere', 'capsule', 'cone', 'torus'];
export const CSG_OPERATION_BADGE: Record<CsgOperation, {
    sign: string;
    className: string;
}> = {
    subtract: { sign: '−', className: 'bg-csg-subtract/20 text-csg-subtract' },
    union: { sign: '+', className: 'bg-csg-union/20 text-csg-union' },
    intersect: { sign: '∩', className: 'bg-csg-intersect/20 text-csg-intersect' },
};
