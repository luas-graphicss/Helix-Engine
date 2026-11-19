import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { OverlayLayer } from '../overlay/viewport-overlay';
import type { ContributionRegistry } from '../registry/contribution-registry';
import type { GizmoContribution } from './gizmo-contribution';
import type { GizmoPainter } from './gizmo-painter';
import { paintGizmos } from './paint-gizmos';
export class GizmoLayer implements OverlayLayer {
    private shown = true;
    constructor(private readonly session: EditorSession, private readonly gizmos: ContributionRegistry<GizmoContribution>) { }
    get visible(): boolean {
        return this.shown;
    }
    setVisible(visible: boolean): void {
        if (this.shown === visible)
            return;
        this.shown = visible;
        this.requestRepaint();
    }
    requestRepaint(): void {
        this.session.notify('view');
    }
    paintInto(painter: GizmoPainter): void {
        const { session } = this;
        const gizmos = this.gizmos.list();
        if (!this.shown || gizmos.length === 0)
            return;
        session.scene.updateWorldMatrices();
        paintGizmos(gizmos, {
            selection: session.selectedEntities(),
            isSelected: (entity) => session.isSelected(entity),
            forEachVisibleActor: (visit) => session.scene.traverseVisible((entity) => {
                if (entity.parent)
                    visit(entity);
            }),
        }, painter);
    }
}
