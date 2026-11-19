import { GizmoPainter, type GizmoLine } from '../gizmos/gizmo-painter';
const MAX_OVERLAY_LINES = 20000;
export interface OverlayLayer {
    paintInto(painter: GizmoPainter): void;
}
export class ViewportOverlay {
    private readonly painter = new GizmoPainter(MAX_OVERLAY_LINES);
    constructor(private readonly layers: readonly OverlayLayer[]) { }
    paint(): readonly GizmoLine[] {
        const { painter } = this;
        painter.reset();
        for (const layer of this.layers) {
            painter.resetStyle();
            layer.paintInto(painter);
        }
        return painter.lines;
    }
}
