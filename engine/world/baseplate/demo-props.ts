import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createBox, createSphere } from '@/engine/renderer/geometry/primitives';
import { createRigidBodySettings, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { defaultMassForSettings } from '@/engine/physics/body/collider-fit';
type Rgb = readonly [
    number,
    number,
    number
];
const CONCRETE: Rgb = [0.64, 0.65, 0.68];
const ACCENT: Rgb = [0.16, 0.4, 0.76];
const CRATE: Rgb = [0.76, 0.54, 0.3];
const STAIR_STEPS = 6;
const STAIR_RISE = 0.2;
const STAIR_TREAD = 0.35;
const STAIR_WIDTH = 2.4;
const CRATE_SIZE = 0.5;
const CRATE_ROWS = 3;
function concrete(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...CONCRETE), roughness: 0.88 });
}
function accent(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...ACCENT), roughness: 0.45 });
}
function crate(name: string): Material {
    return createMaterial({ name, baseColor: vec3.create(...CRATE), roughness: 0.75 });
}
interface BlockOptions {
    rotation?: readonly [
        number,
        number,
        number
    ];
    material?: Material;
    body?: Partial<RigidBodySettings>;
}
function staticBlock(scene: Scene, parent: Entity, name: string, size: readonly [
    number,
    number,
    number
], position: readonly [
    number,
    number,
    number
], options: BlockOptions = {}): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh: createBox(size[0], size[1], size[2]), material: options.material ?? concrete(`${name} · Concreto`) }, parent);
    vec3.set(entity.transform.position, position[0], position[1], position[2]);
    if (options.rotation)
        vec3.set(entity.transform.rotation, options.rotation[0], options.rotation[1], options.rotation[2]);
    entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(size[0], size[1], size[2]), friction: 0.8, ...options.body });
    return entity;
}
function dynamicBody(entity: Entity, settings: Partial<RigidBodySettings>): void {
    const body = createRigidBodySettings(settings);
    body.mass = defaultMassForSettings(body, entity.transform.scale);
    entity.rigidBody = body;
}
function createStaircase(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Escadaria', kind: 'group' }, parent);
    vec3.set(group.transform.position, 7, 0, -3);
    for (let step = 0; step < STAIR_STEPS; step++) {
        const height = STAIR_RISE * (step + 1);
        staticBlock(scene, group, `Degrau_${step + 1}`, [STAIR_WIDTH, height, STAIR_TREAD], [0, height / 2, -step * STAIR_TREAD]);
    }
    const landingHeight = STAIR_RISE * STAIR_STEPS;
    const landingDepth = 2;
    staticBlock(scene, group, 'Patamar', [STAIR_WIDTH, landingHeight, landingDepth], [0, landingHeight / 2, -STAIR_STEPS * STAIR_TREAD - landingDepth / 2 + STAIR_TREAD / 2]);
}
function createRamps(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Rampas', kind: 'group' }, parent);
    const gentleLength = 6;
    const gentleAngle = 20;
    const gentleRise = gentleLength * Math.sin((gentleAngle * Math.PI) / 180);
    staticBlock(scene, group, 'Rampa_Suave', [3, 0.3, gentleLength], [-7, gentleRise / 2 - 0.1, -4], { rotation: [gentleAngle, 0, 0] });
    staticBlock(scene, group, 'Plataforma_Rampa', [3, gentleRise, 3], [-7, gentleRise / 2, -4 - gentleLength / 2 - 1.3], { material: concrete('Plataforma · Concreto') });
    const steepLength = 4;
    const steepAngle = 50;
    const steepRise = steepLength * Math.sin((steepAngle * Math.PI) / 180);
    staticBlock(scene, group, 'Rampa_Ingreme', [3, 0.3, steepLength], [-7, steepRise / 2 - 0.05, 7], { rotation: [-steepAngle, 0, 0] });
}
function createJumpBlocks(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Blocos_de_Salto', kind: 'group' }, parent);
    const heights = [0.5, 1, 1.5, 2];
    heights.forEach((height, index) => {
        staticBlock(scene, group, `Bloco_${height.toFixed(1).replace('.', '_')}m`, [1.6, height, 1.6], [-3 + index * 2.2, height / 2, 9]);
    });
}
function createGate(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Portico', kind: 'group' }, parent);
    vec3.set(group.transform.position, 0, 0, -11);
    const pillar = createBox(0.6, 4, 0.6);
    for (const [name, x] of [
        ['Pilar_E', -1.8],
        ['Pilar_D', 1.8],
    ] as const) {
        const entity = scene.createEntity({ name, kind: 'mesh', mesh: pillar, material: concrete(`${name} · Concreto`) }, group);
        vec3.set(entity.transform.position, x, 2, 0);
        entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(0.6, 4, 0.6), friction: 0.8 });
    }
    staticBlock(scene, group, 'Lintel', [4.8, 0.5, 0.8], [0, 4.25, 0], { material: accent('Lintel · Azul Helix') });
}
function createCratePyramid(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Caixotes', kind: 'group' }, parent);
    vec3.set(group.transform.position, 5, 0, 5);
    const mesh: MeshData = createBox(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE);
    let index = 1;
    for (let row = 0; row < CRATE_ROWS; row++) {
        const count = CRATE_ROWS - row;
        for (let column = 0; column < count; column++) {
            const entity = scene.createEntity({ name: `Caixote_${index++}`, kind: 'mesh', mesh, material: crate('Caixote · Madeira') }, group);
            const x = (column - (count - 1) / 2) * (CRATE_SIZE + 0.02);
            vec3.set(entity.transform.position, x, CRATE_SIZE * (row + 0.5), (row % 2) * 0.03);
            vec3.set(entity.transform.rotation, 0, row * 4, 0);
            dynamicBody(entity, { collider: 'box', boxSize: vec3.create(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE), friction: 0.6 });
        }
    }
}
function createBalls(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Bolas', kind: 'group' }, parent);
    const radius = 0.4;
    const mesh = createSphere(radius);
    const positions: ReadonlyArray<readonly [
        number,
        number
    ]> = [
        [-4, 3],
        [-5.2, 4.6],
    ];
    positions.forEach(([x, z], index) => {
        const entity = scene.createEntity({ name: `Bola_${index + 1}`, kind: 'mesh', mesh, material: accent('Bola · Azul Helix') }, group);
        vec3.set(entity.transform.position, x, radius, z);
        dynamicBody(entity, { collider: 'sphere', radius, friction: 0.5, restitution: 0.5, angularDamping: 0.3 });
    });
}
export function createDemoProps(scene: Scene, parent: Entity): void {
    createStaircase(scene, parent);
    createRamps(scene, parent);
    createJumpBlocks(scene, parent);
    createGate(scene, parent);
    staticBlock(scene, parent, 'Mureta', [5, 0.9, 0.4], [10, 0.45, 2], { rotation: [0, 90, 0] });
    createCratePyramid(scene, parent);
    createBalls(scene, parent);
}
