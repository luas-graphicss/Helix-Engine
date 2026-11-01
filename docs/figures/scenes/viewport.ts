import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import { createBox } from '@/engine/renderer/geometry/primitives';
import type { GizmoMode } from '@/engine/renderer/gizmo/gizmo-frame';
import { createFigureScene, figureMaterial, lookAt, type FigureScene } from '../figure-scene';
const SUBJECT_NAME = 'Ator';
function gizmoFigure(id: string, mode: GizmoMode): FigureScene {
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
        gizmo(scene: Scene) {
            const subject = scene.root.children.find((entity) => entity.name === SUBJECT_NAME);
            if (!subject)
                throw new Error(`Figura ${id}: o ator do gizmo sumiu da cena`);
            return { mode, worldMatrix: subject.worldMatrix, localAxes: false, scale: 1.15, hovered: null, active: null };
        },
    };
}
export const VIEWPORT_FIGURES: readonly FigureScene[] = [
    gizmoFigure('viewport/gizmo-mover', 'translate'),
    gizmoFigure('viewport/gizmo-rotacionar', 'rotate'),
    gizmoFigure('viewport/gizmo-escalar', 'scale'),
];
