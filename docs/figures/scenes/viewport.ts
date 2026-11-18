import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createGizmoFrame } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { GizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-handle';
import { buildGizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-layout';
import { drawGizmoLayout } from '@/engine/editor/transform/gizmo/handle-drawing';
import type { GizmoTool } from '@/engine/editor/transform/transform-settings';
import { GizmoDrawList } from '@/engine/renderer/gizmo/gizmo-draw-list';
import { createFigureScene, figureMaterial, lookAt, type FigureScene } from '../figure-scene';
const SUBJECT_NAME = 'Ator';
const GIZMO_SCALE = 1.15;
const IDLE = { hovered: null, active: null };
function gizmoFigure(id: string, tool: GizmoTool): FigureScene {
    const frame = createGizmoFrame();
    const layout = new GizmoLayout();
    const drawList = new GizmoDrawList();
    return {
        id,
        width: 900,
        height: 760,
        showGrid: true,
        build(camera) {
            const scene = createFigureScene();
            const subject = scene.createEntity({ name: SUBJECT_NAME, kind: 'mesh', mesh: createBox(1.4, 1.4, 1.4), material: figureMaterial(SUBJECT_NAME, 'amber') });
            vec3.set(subject.transform.position, 0, 0.7, 0);
            lookAt(camera, [3.6, 3, 4.4], [0, 0.75, 0], 40);
            return scene;
        },
        gizmo(scene: Scene, camera) {
            const subject = scene.root.children.find((entity) => entity.name === SUBJECT_NAME);
            if (!subject)
                throw new Error(`Figura ${id}: o ator do gizmo sumiu da cena`);
            const targets = { entities: [subject], active: subject };
            if (!buildGizmoLayout(layout, frame, { tool, targets, pivotMode: 'pivot', space: 'global', camera, scale: GIZMO_SCALE, frozenAxes: null }))
                throw new Error(`Figura ${id}: o gizmo ficou atrás da câmera`);
            drawGizmoLayout(drawList, layout, frame.origin, IDLE, camera);
            return drawList;
        },
    };
}
export const VIEWPORT_FIGURES: readonly FigureScene[] = [
    gizmoFigure('viewport/gizmo-mover', 'translate'),
    gizmoFigure('viewport/gizmo-rotacionar', 'rotate'),
    gizmoFigure('viewport/gizmo-escalar', 'scale'),
];
