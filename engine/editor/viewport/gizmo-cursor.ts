import type { HandleAction } from '@/engine/editor/transform/gizmo/gizmo-handle';
export function gizmoCursor(action: HandleAction, dragging: boolean): string {
    switch (action.kind) {
        case 'translateAxis':
        case 'translatePlane':
        case 'translateView':
            return 'move';
        case 'rotateAxis':
        case 'rotateView':
        case 'rectRotate':
            return dragging ? 'grabbing' : 'grab';
        case 'scaleAxis':
        case 'scalePlane':
        case 'scaleUniform':
        case 'rectEdge':
        case 'rectCorner':
            return 'nwse-resize';
    }
}
