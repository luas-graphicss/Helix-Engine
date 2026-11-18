import { describeEntities } from '@/engine/editor/operations/entity-operations';
import { commitTransforms } from '@/engine/editor/operations/transform-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { GizmoDrawList } from '@/engine/renderer/gizmo/gizmo-draw-list';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { GizmoDrag } from './drag/gizmo-drag';
import { createGizmoFrame } from './gizmo/gizmo-frame';
import { GizmoLayout, type HandleAction } from './gizmo/gizmo-handle';
import { buildGizmoLayout } from './gizmo/gizmo-layout';
import type { GizmoPointer } from './gizmo/gizmo-pointer';
import { drawGizmoLayout } from './gizmo/handle-drawing';
import { pickHandle } from './gizmo/handle-picking';
import { resolveTransformTargets, type TransformTargets } from './selection/transform-targets';
export class TransformGizmo {
    hovered: string | null = null;
    active: string | null = null;
    readout: string | null = null;
    private readonly frame = createGizmoFrame();
    private readonly layout = new GizmoLayout();
    private readonly drawList = new GizmoDrawList();
    private drag: GizmoDrag | null = null;
    private targets: TransformTargets | null = null;
    private targetsVersion = -1;
    constructor(private readonly session: EditorSession) { }
    hover(pointer: GizmoPointer): HandleAction | null {
        const handle = this.prepareLayout() ? pickHandle(this.layout, this.session.camera, pointer) : null;
        this.hovered = handle?.id ?? null;
        return handle?.action ?? null;
    }
    clearHover(): void {
        this.hovered = null;
    }
    beginDrag(pointer: GizmoPointer): HandleAction | null {
        const { session } = this;
        session.scene.updateWorldMatrices();
        const targets = this.currentTargets();
        if (!targets || !this.prepareLayout())
            return null;
        const handle = pickHandle(this.layout, session.camera, pointer);
        if (!handle)
            return null;
        const drag = GizmoDrag.begin({ camera: session.camera, frame: this.frame, handle, targets, pivotMode: session.pivotMode, pointer });
        if (!drag)
            return null;
        this.drag = drag;
        this.active = handle.id;
        this.hovered = handle.id;
        this.readout = drag.readout;
        return handle.action;
    }
    updateDrag(pointer: GizmoPointer): void {
        const { drag, session } = this;
        if (!drag)
            return;
        drag.update(pointer, session.snap);
        this.readout = drag.readout;
        session.notifyLiveEdit();
    }
    commitDrag(): void {
        const { drag, session } = this;
        if (!drag)
            return;
        this.releaseDrag();
        const changes = drag.changes();
        if (changes.length === 0) {
            session.notify();
            return;
        }
        commitTransforms(session, changes, `${drag.verb} ${describeEntities(changes.map((change) => change.entity))}`);
    }
    cancelDrag(): void {
        const { drag } = this;
        if (!drag)
            return;
        drag.restore();
        this.releaseDrag();
        this.session.notify();
    }
    renderRequest(): GizmoDrawList | null {
        if (this.drag)
            this.session.scene.updateWorldMatrices();
        if (!this.prepareLayout())
            return null;
        this.drag?.decorate(this.layout);
        drawGizmoLayout(this.drawList, this.layout, this.frame.origin, this, this.session.camera);
        return this.drawList;
    }
    private releaseDrag(): void {
        this.drag = null;
        this.active = null;
        this.readout = null;
    }
    private currentTargets(): TransformTargets | null {
        const { session } = this;
        const version = session.getVersion();
        if (version !== this.targetsVersion) {
            this.targetsVersion = version;
            this.targets = resolveTransformTargets(session.selectionRoots(), session.selectedEntity);
        }
        return this.targets;
    }
    private prepareLayout(): boolean {
        const { session } = this;
        const tool = session.gizmoMode;
        const targets = this.currentTargets();
        if (!tool || !targets)
            return false;
        return buildGizmoLayout(this.layout, this.frame, {
            tool,
            targets,
            pivotMode: session.pivotMode,
            space: session.space,
            camera: session.camera,
            scale: engineSettings.get('editor.gizmo.size'),
            frozenAxes: this.drag?.frame.axes ?? null,
        });
    }
}
