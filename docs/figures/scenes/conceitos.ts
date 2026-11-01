import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createPointLight, createSpotLight } from '@/engine/core/scene/light';
import type { Scene } from '@/engine/core/scene/scene';
import { createBox, createCapsule, createCone, createCylinder, createPlane, createRoundedBox, createSphere, createTorus } from '@/engine/renderer/geometry/primitives';
import { createFigureScene, figureMaterial, lookAt, type FigureColor, type FigureScene } from '../figure-scene';
type Xyz = readonly [
    number,
    number,
    number
];
function box(scene: Scene, parent: Entity | undefined, name: string, size: Xyz, position: Xyz, color: FigureColor, rotation?: Xyz): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh: createBox(size[0], size[1], size[2]), material: figureMaterial(name, color) }, parent ?? scene.root);
    vec3.set(entity.transform.position, position[0], position[1], position[2]);
    if (rotation)
        vec3.set(entity.transform.rotation, rotation[0], rotation[1], rotation[2]);
    return entity;
}
function floor(scene: Scene, width: number, depth: number): Entity {
    const entity = scene.createEntity({ name: 'Chão', kind: 'mesh', mesh: createBox(width, 0.2, depth), material: figureMaterial('Chão', 'graphite', { roughness: 0.9 }) });
    vec3.set(entity.transform.position, 0, -0.1, 0);
    return entity;
}
const hierarquia: FigureScene = {
    id: 'conceitos/hierarquia',
    width: 1600,
    height: 900,
    showGrid: true,
    build(camera) {
        const scene = createFigureScene();
        const parent = box(scene, undefined, 'Pai', [4.2, 0.4, 4.2], [0, 0.2, 0], 'amber', [0, 28, 0]);
        const spots: Xyz[] = [
            [-1.2, 0.75, -1.2],
            [1.2, 0.75, -1.2],
            [-1.2, 0.75, 1.2],
            [1.2, 0.75, 1.2],
        ];
        spots.forEach((spot, index) => {
            const child = box(scene, parent, `Filho_${index + 1}`, [1.1, 0.7, 1.1], spot, 'blue');
            box(scene, child, `Neto_${index + 1}`, [0.45, 0.45, 0.45], [0, 0.575, 0], 'slate');
        });
        lookAt(camera, [6.5, 5.2, 7.5], [0, 0.45, 0], 36);
        return scene;
    },
};
const transformacoes: FigureScene = {
    id: 'conceitos/transformacoes',
    width: 1600,
    height: 800,
    showGrid: true,
    build(camera) {
        const scene = createFigureScene();
        box(scene, undefined, 'Posição', [1.2, 1.2, 1.2], [-3.4, 0.6, 0], 'amber');
        box(scene, undefined, 'Rotação', [1.2, 1.2, 1.2], [0, 0.85, 0], 'amber', [0, 35, 25]);
        const scaled = box(scene, undefined, 'Escala', [1.2, 1.2, 1.2], [3.6, 0.9, 0], 'amber');
        vec3.set(scaled.transform.scale, 1.5, 1.5, 1.5);
        lookAt(camera, [1.2, 4.6, 9.8], [0.1, 0.7, 0], 36);
        return scene;
    },
};
const materiais: FigureScene = {
    id: 'conceitos/materiais',
    width: 1600,
    height: 800,
    showGrid: false,
    build(camera) {
        const scene = createFigureScene({ sky: true });
        scene.sky.clouds.enabled = false;
        const mesh = createSphere(0.62, 48, 24);
        const steps = 6;
        for (let index = 0; index < steps; index++) {
            const roughness = index / (steps - 1);
            const x = (index - (steps - 1) / 2) * 1.6;
            const dielectric = scene.createEntity({ name: `Dielétrico_${index}`, kind: 'mesh', mesh, material: figureMaterial('Dielétrico', 'amber', { roughness, metallic: 0 }) });
            vec3.set(dielectric.transform.position, x, 1.95, 0);
            const metal = scene.createEntity({ name: `Metal_${index}`, kind: 'mesh', mesh, material: figureMaterial('Metal', [0.9, 0.9, 0.92], { roughness, metallic: 1 }) });
            vec3.set(metal.transform.position, x, 0.45, 0);
        }
        lookAt(camera, [0, 1.6, 11.2], [0, 1.2, 0], 34);
        return scene;
    },
};
const luzes: FigureScene = {
    id: 'conceitos/luzes',
    width: 1600,
    height: 800,
    showGrid: false,
    build(camera) {
        const scene = createFigureScene({ sunIntensity: 0.35, ambientIntensity: 0.25 });
        floor(scene, 16, 9);
        const positions: Xyz[] = [
            [-4.2, 0.5, 0],
            [0, 0.5, 0],
            [4.2, 0.5, 0],
        ];
        positions.forEach((position, index) => box(scene, undefined, `Pedestal_${index + 1}`, [1.2, 1, 1.2], position, 'slate'));
        const point = scene.createEntity({ name: 'Pontual', kind: 'light', light: createPointLight({ color: vec3.create(1, 0.72, 0.42), intensity: 26, range: 7 }) });
        vec3.set(point.transform.position, -4.2, 2.6, 0.6);
        const spot = scene.createEntity({ name: 'Cônica', kind: 'light', light: createSpotLight({ color: vec3.create(0.78, 0.88, 1), intensity: 70, range: 9, outerAngle: 32, innerAngle: 18 }) });
        vec3.set(spot.transform.position, 0, 3.6, 0);
        vec3.set(spot.transform.rotation, -90, 0, 0);
        lookAt(camera, [0.4, 4.2, 11.5], [0, 0.6, 0], 36);
        return scene;
    },
};
const prefabs: FigureScene = {
    id: 'conceitos/prefabs',
    width: 1600,
    height: 800,
    showGrid: true,
    build(camera) {
        const scene = createFigureScene();
        const pole = createCylinder(0.11, 2.4, 24);
        const base = createCylinder(0.38, 0.18, 24);
        const lamp = createSphere(0.34, 32, 16);
        for (const [index, x] of [-3.4, 0, 3.4].entries()) {
            const instance = scene.createEntity({ name: `Poste_${index + 1}`, kind: 'group' });
            vec3.set(instance.transform.position, x, 0, 0);
            const foot = scene.createEntity({ name: 'Base', kind: 'mesh', mesh: base, material: figureMaterial('Base', 'graphite') }, instance);
            vec3.set(foot.transform.position, 0, 0.09, 0);
            const shaft = scene.createEntity({ name: 'Haste', kind: 'mesh', mesh: pole, material: figureMaterial('Haste', 'slate', { metallic: 0.6, roughness: 0.4 }) }, instance);
            vec3.set(shaft.transform.position, 0, 1.38, 0);
            const bulb = scene.createEntity({ name: 'Lâmpada', kind: 'mesh', mesh: lamp, material: figureMaterial('Lâmpada', 'amber', { emissive: vec3.create(0.95, 0.55, 0.18), emissiveIntensity: 2.4, roughness: 0.3 }) }, instance);
            vec3.set(bulb.transform.position, 0, 2.88, 0);
        }
        lookAt(camera, [3.2, 3.6, 10.4], [0, 1.4, 0], 36);
        return scene;
    },
};
const primitivas: FigureScene = {
    id: 'cena/primitivas',
    width: 1600,
    height: 700,
    showGrid: true,
    build(camera) {
        const scene = createFigureScene();
        const shapes = [
            ['Cubo', createBox(1, 1, 1), 0.5],
            ['Cubo arredondado', createRoundedBox(1, 1, 1, 0.14), 0.5],
            ['Plano', createPlane(1.2, 1.2), 0.01],
            ['Esfera', createSphere(0.55, 48, 24), 0.55],
            ['Cilindro', createCylinder(0.45, 1, 32), 0.5],
            ['Cone', createCone(0.5, 1, 32), 0.5],
            ['Toro', createTorus(0.42, 0.16, 48, 24), 0.42],
            ['Cápsula', createCapsule(0.3, 0.5, 32, 8), 0.55],
        ] as const;
        shapes.forEach(([name, mesh, lift], index) => {
            const entity = scene.createEntity({ name, kind: 'mesh', mesh, material: figureMaterial(name, index % 2 === 0 ? 'amber' : 'blue') });
            vec3.set(entity.transform.position, (index - (shapes.length - 1) / 2) * 1.75, lift, 0);
            if (name === 'Toro')
                vec3.set(entity.transform.rotation, 90, 0, 0);
        });
        lookAt(camera, [0.6, 3.4, 9.6], [0, 0.35, 0], 42);
        return scene;
    },
};
export const CONCEITOS_FIGURES: readonly FigureScene[] = [hierarquia, transformacoes, materiais, luzes, prefabs, primitivas];
