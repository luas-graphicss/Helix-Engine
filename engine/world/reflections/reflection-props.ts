import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import { createBox, createCapsule, createCone, createCylinder, createRoundedBox, createSphere, createTorus } from '@/engine/renderer/geometry/primitives';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import type { Heightfield } from '@/engine/terrain/core/heightfield';
import { staticBlock } from '../props/static-block';
type Rgb = readonly [
    number,
    number,
    number
];
export const LAKE_CENTER: Rgb = [0, 0, 34];
export const LAKE_SHORE_RADIUS = 32;
export const WATER_LEVEL = -0.35;
const GALLERY_ROUGHNESS = [0.02, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9] as const;
const GALLERY_SPACING = 1.7;
const SPHERE_RADIUS = 0.6;
const METALS: readonly {
    name: string;
    color: Rgb;
    roughness: number;
}[] = [
    { name: 'Cromo', color: [0.55, 0.556, 0.554], roughness: 0.03 },
    { name: 'Alumínio', color: [0.913, 0.922, 0.924], roughness: 0.12 },
    { name: 'Ouro', color: [1.0, 0.766, 0.336], roughness: 0.2 },
    { name: 'Cobre', color: [0.955, 0.638, 0.538], roughness: 0.3 },
    { name: 'Latão', color: [0.88, 0.78, 0.5], roughness: 0.25 },
    { name: 'Ferro', color: [0.56, 0.57, 0.58], roughness: 0.45 },
];
const PILLARS: readonly {
    name: string;
    color: Rgb;
}[] = [
    { name: 'Vermelho', color: [0.7, 0.08, 0.06] },
    { name: 'Amarelo', color: [0.9, 0.72, 0.1] },
    { name: 'Azul', color: [0.16, 0.4, 0.76] },
    { name: 'Branco', color: [0.9, 0.9, 0.88] },
];
function metal(name: string, color: Rgb, roughness: number): Material {
    return createMaterial({ name, baseColor: vec3.create(...color), roughness, metallic: 1 });
}
function paint(name: string, color: Rgb, roughness: number): Material {
    return createMaterial({ name, baseColor: vec3.create(...color), roughness, metallic: 0 });
}
function polishedGranite(name: string): Material {
    return paint(name, [0.03, 0.03, 0.035], 0.08);
}
function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}
export function shapeReflectionRelief(heightfield: Heightfield, size: number): void {
    const { resolution, heights } = heightfield;
    const [lakeX, , lakeZ] = LAKE_CENTER;
    for (let gz = 0; gz < resolution; gz++) {
        const z = (gz / (resolution - 1) - 0.5) * size;
        for (let gx = 0; gx < resolution; gx++) {
            const x = (gx / (resolution - 1) - 0.5) * size;
            const index = gz * resolution + gx;
            let height = heights[index];
            const plazaX = 1 - smoothstep(30, 44, Math.abs(x));
            const plazaZ = 1 - smoothstep(0, 14, Math.max(-34 - z, z - 4, 0));
            const plaza = plazaX * plazaZ;
            height = height * (1 - plaza);
            const distance = Math.hypot(x - lakeX, z - lakeZ);
            const floor = -6 + 3.4 * smoothstep(4, LAKE_SHORE_RADIUS - 5, distance);
            const bowl = floor * (1 - smoothstep(LAKE_SHORE_RADIUS - 5, LAKE_SHORE_RADIUS + 1, distance));
            const lake = 1 - smoothstep(LAKE_SHORE_RADIUS, LAKE_SHORE_RADIUS + 12, distance);
            height = height * (1 - lake) + bowl * lake;
            heights[index] = height;
        }
    }
}
function placeMesh(scene: Scene, parent: Entity, name: string, mesh: MeshData, material: Material, position: Rgb, rotation?: Rgb): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh, material }, parent);
    vec3.set(entity.transform.position, position[0], position[1], position[2]);
    if (rotation)
        vec3.set(entity.transform.rotation, rotation[0], rotation[1], rotation[2]);
    return entity;
}
function sphereBody(entity: Entity, radius: number): void {
    entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'sphere', radius, friction: 0.6 });
}
function boxBody(entity: Entity, size: Rgb): void {
    entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(size[0], size[1], size[2]), friction: 0.7 });
}
function createGallery(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Galeria PBR', kind: 'group' }, parent);
    vec3.set(group.transform.position, -4, 0, -16);
    const plinth = [GALLERY_SPACING * GALLERY_ROUGHNESS.length + 1.6, 0.5, 5.2] as const;
    staticBlock(scene, group, 'Plinto', plinth, [0, plinth[1] / 2, 0], { material: polishedGranite('Plinto · Granito polido') });
    const firstX = (-(GALLERY_ROUGHNESS.length - 1) * GALLERY_SPACING) / 2;
    GALLERY_ROUGHNESS.forEach((roughness, index) => {
        const x = firstX + index * GALLERY_SPACING;
        const y = plinth[1] + SPHERE_RADIUS;
        const label = roughness.toFixed(2).replace('.', ',');
        const steel = placeMesh(scene, group, `Aço ${label}`, createSphere(SPHERE_RADIUS, 48, 24), metal(`Aço · rugosidade ${label}`, [0.92, 0.92, 0.93], roughness), [x, y, -1.3]);
        sphereBody(steel, SPHERE_RADIUS);
        const painted = placeMesh(scene, group, `Tinta ${label}`, createSphere(SPHERE_RADIUS, 48, 24), paint(`Tinta · rugosidade ${label}`, [0.6, 0.08, 0.06], roughness), [x, y, 1.3]);
        sphereBody(painted, SPHERE_RADIUS);
    });
}
function createMetals(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Metais', kind: 'group' }, parent);
    vec3.set(group.transform.position, 14, 0, -20);
    const shapes: ((size: number) => MeshData)[] = [
        (size) => createSphere(size * 0.5, 48, 24),
        (size) => createTorus(size * 0.38, size * 0.14, 64, 32),
        (size) => createCapsule(size * 0.28, size * 0.5, 48, 12),
        (size) => createCylinder(size * 0.4, size * 0.9, 48),
        (size) => createRoundedBox(size * 0.8, size * 0.8, size * 0.8, size * 0.12),
        (size) => createCone(size * 0.45, size * 1.0, 48),
    ];
    const pedestalSize = [1.2, 0.9, 1.2] as const;
    METALS.forEach(({ name, color, roughness }, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = (column - 1) * 2.6;
        const z = (row - 0.5) * 2.6;
        staticBlock(scene, group, `Pedestal_${name}`, pedestalSize, [x, pedestalSize[1] / 2, z], { material: polishedGranite(`Pedestal · Granito polido`) });
        const size = 1.1;
        const entity = placeMesh(scene, group, name, shapes[index](size), metal(`${name} · metal`, color, roughness), [x, pedestalSize[1] + size * 0.5, z]);
        boxBody(entity, [size * 0.8, size, size * 0.8]);
    });
}
function createMirror(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Espelho', kind: 'group' }, parent);
    vec3.set(group.transform.position, -22, 0, -8);
    vec3.set(group.transform.rotation, 0, -35, 0);
    const panel = [10, 4.5, 0.25] as const;
    const base = [10.6, 0.3, 1.2] as const;
    staticBlock(scene, group, 'Base', base, [0, base[1] / 2, 0], { material: polishedGranite('Base · Granito polido') });
    const mirror = placeMesh(scene, group, 'Painel espelhado', createBox(panel[0], panel[1], panel[2]), metal('Aço espelhado', [0.93, 0.93, 0.94], 0.02), [0, base[1] + panel[1] / 2, 0]);
    boxBody(mirror, panel);
    const brushed = placeMesh(scene, group, 'Painel escovado', createBox(panel[0] * 0.5, panel[1], panel[2]), metal('Aço escovado', [0.85, 0.85, 0.86], 0.4), [panel[0] * 0.75 + 0.3, base[1] + panel[1] / 2, 0]);
    boxBody(brushed, [panel[0] * 0.5, panel[1], panel[2]]);
}
function createShoreline(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Margem', kind: 'group' }, parent);
    vec3.set(group.transform.position, 0, 0, 1);
    const radius = 0.45;
    const height = 4;
    PILLARS.forEach(({ name, color }, index) => {
        const x = (index - 1.5) * 3.2 + 6;
        const pillar = placeMesh(scene, group, `Pilar ${name}`, createCylinder(radius, height, 48), paint(`Pilar · ${name}`, color, 0.5), [x, height / 2, 0]);
        boxBody(pillar, [radius * 2, height, radius * 2]);
    });
    const pole = [0.18, 3.2, 0.18] as const;
    staticBlock(scene, group, 'Haste', pole, [-8, pole[1] / 2, 0], { material: metal('Haste · Ferro', [0.56, 0.57, 0.58], 0.5) });
    const beacon = placeMesh(scene, group, 'Farol', createSphere(0.45, 32, 16), createMaterial({ name: 'Farol · emissivo', baseColor: vec3.create(1, 0.5, 0.15), roughness: 0.4, emissive: vec3.create(1, 0.45, 0.12), emissiveIntensity: 6 }), [-8, pole[1] + 0.45, 0]);
    sphereBody(beacon, 0.45);
}
function createFloor(scene: Scene, parent: Entity): void {
    const slab = [30, 0.16, 14] as const;
    staticBlock(scene, parent, 'Piso polido', slab, [0, slab[1] / 2, -12], { material: paint('Piso · Concreto encerado', [0.2, 0.2, 0.22], 0.14) });
}
export function createReflectionProps(scene: Scene, parent: Entity): void {
    createFloor(scene, parent);
    createGallery(scene, parent);
    createMetals(scene, parent);
    createMirror(scene, parent);
    createShoreline(scene, parent);
}
