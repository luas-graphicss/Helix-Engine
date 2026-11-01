import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import { createBox, createCone, createCylinder } from '@/engine/renderer/geometry/primitives';
import { createFigureScene, figureMaterial, lookAt, type FigureColor, type FigureScene } from '../figure-scene';
const AXIS_LENGTH = 3;
const AXIS_RADIUS = 0.055;
const HEAD_LENGTH = 0.42;
function arrow(scene: Scene, name: string, color: FigureColor, rotation: readonly [
    number,
    number,
    number
]): void {
    const group = scene.createEntity({ name, kind: 'group' });
    vec3.set(group.transform.rotation, rotation[0], rotation[1], rotation[2]);
    const material = figureMaterial(name, color, { roughness: 0.5 });
    const shaftLength = AXIS_LENGTH - HEAD_LENGTH;
    const shaft = scene.createEntity({ name: 'Haste', kind: 'mesh', mesh: createCylinder(AXIS_RADIUS, shaftLength, 24), material }, group);
    vec3.set(shaft.transform.position, 0, shaftLength / 2, 0);
    const head = scene.createEntity({ name: 'Ponta', kind: 'mesh', mesh: createCone(AXIS_RADIUS * 3.2, HEAD_LENGTH, 24), material }, group);
    vec3.set(head.transform.position, 0, shaftLength + HEAD_LENGTH / 2, 0);
}
const eixos: FigureScene = {
    id: 'matematica/eixos',
    width: 1600,
    height: 900,
    showGrid: true,
    build(camera) {
        const scene = createFigureScene();
        const origin = scene.createEntity({ name: 'Origem', kind: 'mesh', mesh: createBox(0.5, 0.5, 0.5), material: figureMaterial('Origem', 'slate') });
        vec3.set(origin.transform.position, 0, 0.25, 0);
        arrow(scene, 'X', 'red', [0, 0, -90]);
        arrow(scene, 'Y', 'green', [0, 0, 0]);
        arrow(scene, 'Z', 'blue', [90, 0, 0]);
        lookAt(camera, [5.2, 4.1, 6.4], [0.9, 1.1, 0.9], 38);
        return scene;
    },
};
export const MATEMATICA_FIGURES: readonly FigureScene[] = [eixos];
