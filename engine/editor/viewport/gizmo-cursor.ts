import type { HandleAction } from '@/engine/editor/transform/gizmo/gizmo-handle';
export function gizmoCursor(action: HandleAction, dragging: boolean): string {
    switch (action.kind) {
        case 'translateAxis':
        case 'translatePlane':
        case 'translateView':
            return 'move';
        case 'rotateAxis':
        case 'rotateView':
            return dragging ? 'grabbing' : 'grab';
        case 'scaleAxis':
        case 'scalePlane':
        case 'scaleUniform':
            return 'nwse-resize';
    }
}
