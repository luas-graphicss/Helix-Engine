import { createRay } from '@/engine/core/math/ray';
import type { Entity } from '@/engine/core/scene/entity';
import { describeEntities } from '@/engine/editor/operations/entity-operations';
import { commitTransforms } from '@/engine/editor/operations/transform-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import { GizmoDrawList } from '@/engine/renderer/gizmo/gizmo-draw-list';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { GizmoDrag } from './drag/gizmo-drag';
import { createGizmoFrame } from './gizmo/gizmo-frame';
import { GizmoLayout, type HandleAction } from './gizmo/gizmo-handle';
import { buildGizmoLayout } from './gizmo/gizmo-layout';
import type { GizmoPointer } from './gizmo/gizmo-pointer';
import { drawGizmoLayout } from './gizmo/handle-drawing';
import { pickHandle } from './gizmo/handle-picking';
import { addVertexGrip, VERTEX_GRIP_ID } from './gizmo/handles/vertex-grip';
import { collectSubtrees, resolveTransformTargets, type TransformTargets } from './selection/transform-targets';
import { SnapTargets } from './snap/snap-targets';
import { createVertexHit, nearestVertexToPointer, vertexWorldPosition } from './snap/vertex-snap';
function describeDrag(drag: GizmoDrag): string {
    return `${drag.verb} · ${drag.readout}`;
}
export class TransformGizmo {
    hovered: string | null = null;
    active: string | null = null;
    readout: string | null = null;
    private readonly frame = createGizmoFrame();
    private readonly layout = new GizmoLayout();
    private readonly drawList = new GizmoDrawList();
    private readonly pointerRay = createRay();
    private readonly grip = createVertexHit();
    private gripVisible = false;
    private drag: GizmoDrag | null = null;
    private targets: TransformTargets | null = null;
    private targetMembers: readonly Entity[] = [];
    private targetsVersion = -1;
    constructor(private readonly session: EditorSession) { }
    get vertexGripKey(): string {
        const { entity, index } = this.grip;
        return this.gripVisible && entity ? `${entity.id}:${index}` : '';
    }
    hover(pointer: GizmoPointer): HandleAction | null {
        this.locateVertexGrip(pointer);
        const handle = this.prepareLayout() ? pickHandle(this.layout, this.session.camera, pointer) : null;
        this.hovered = handle?.id ?? null;
        return handle?.action ?? null;
    }
    clearHover(): void {
        this.hovered = null;
        if (!this.drag)
            this.gripVisible = false;
    }
    beginDrag(pointer: GizmoPointer): HandleAction | null {
        const { session } = this;
        session.scene.updateWorldMatrices();
        const targets = this.currentTargets();
        this.locateVertexGrip(pointer);
        if (!targets || !this.prepareLayout())
            return null;
        const handle = pickHandle(this.layout, session.camera, pointer);
        if (!handle)
            return null;
        const drag = GizmoDrag.begin({ camera: session.camera, frame: this.frame, handle, targets, pivotMode: session.pivotMode, pointer, snapTargets: new SnapTargets(session.scene, targets.entities) });
        if (!drag)
            return null;
        this.drag = drag;
        this.gripVisible = handle.id === VERTEX_GRIP_ID;
        this.active = handle.id;
        this.hovered = handle.id;
        this.readout = describeDrag(drag);
        session.notifyLiveEdit();
        return handle.action;
    }
    updateDrag(pointer: GizmoPointer): void {
        const { drag, session } = this;
        if (!drag)
            return;
        drag.update(pointer, session.snap);
        this.readout = describeDrag(drag);
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
        this.gripVisible = false;
        this.active = null;
        this.readout = null;
        this.session.notifyLiveEdit();
    }
    private currentTargets(): TransformTargets | null {
        const { session } = this;
        const version = session.getVersion();
        if (version !== this.targetsVersion) {
            this.targetsVersion = version;
            this.targets = resolveTransformTargets(session.selectionRoots(), session.selectedEntity);
            this.targetMembers = this.targets ? collectSubtrees(session.scene, this.targets.entities) : [];
        }
        return this.targets;
    }
    private locateVertexGrip(pointer: GizmoPointer): void {
        const { session } = this;
        if (this.drag)
            return;
        this.gripVisible = false;
        const snapping = session.snap.enabled !== pointer.ctrl;
        if (!snapping || session.snap.target !== 'vertex' || session.gizmoMode !== 'translate' || !this.currentTargets())
            return;
        if (!buildPickRay(this.pointerRay, session.camera, pointer.x / pointer.width, pointer.y / pointer.height))
            return;
        this.gripVisible = nearestVertexToPointer(this.grip, this.targetMembers, session.camera, pointer, this.pointerRay);
    }
    private placeVertexGrip(): void {
        const { entity, index, point } = this.grip;
        if (entity && vertexWorldPosition(point, entity, index))
            addVertexGrip(this.layout, this.frame, point);
    }
    private prepareLayout(): boolean {
        const { session } = this;
        const tool = session.gizmoMode;
        const targets = this.currentTargets();
        if (!tool || !targets)
            return false;
        const built = buildGizmoLayout(this.layout, this.frame, {
            tool,
            targets,
            pivotMode: session.pivotMode,
            space: session.space,
            camera: session.camera,
            scale: engineSettings.get('editor.gizmo.size'),
            frozenAxes: this.drag?.frame.axes ?? null,
        });
        if (built && this.gripVisible)
            this.placeVertexGrip();
        return built;
    }
}
