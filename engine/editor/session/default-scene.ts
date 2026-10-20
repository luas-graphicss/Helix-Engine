import { Scene } from '@/engine/core/scene/scene';
import * as vec3 from '@/engine/core/math/vec3';
import { createMaterial } from '@/engine/core/scene/material';
import { createAmbientLight, createDirectionalLight } from '@/engine/core/scene/light';
import { sunDirectionFromTime, sunRotationFromDirection } from '@/engine/core/environment/celestial';
import { createBox, createPlane, createSphere, createCylinder } from '@/engine/renderer/geometry/primitives';
import { createRigidBodyForEntity } from '@/engine/editor/operations/physics-operations';
import { createStarterLayers } from '@/engine/editor/operations/terrain-operations';
import { Terrain } from '@/engine/terrain/core/terrain';
import { createGenerationParams, generateTerrainHeights } from '@/engine/terrain/generation/terrain-generator';
import { autoPaintTerrain } from '@/engine/terrain/generation/auto-paint';
import { sculptFlatten, type Stamp } from '@/engine/terrain/sculpt/sculpt-tools';
import type { TerrainMaterialLibrary } from '@/engine/terrain/materials/terrain-material-library';
function material(r: number, g: number, b: number, roughness: number, metallic = 0) {
    return createMaterial({ baseColor: vec3.create(r, g, b), roughness, metallic });
}
const STACK_LEVELS = 4;
const STACK_BOX_SIZE = 0.8;
const TERRAIN_SIZE = 240;
const CLEARING_RADIUS = 11;
function createDemoTerrain(materials: TerrainMaterialLibrary): Terrain {
    const params = createGenerationParams({ preset: 'hills', seed: 4821, amplitude: 22, featureSize: 95, detail: 0.55, erosion: 2 });
    const terrain = new Terrain({ size: TERRAIN_SIZE, resolution: 257, splatResolution: 512, layers: createStarterLayers(materials, 'hills') });
    const { heightfield } = terrain;
    generateTerrainHeights(heightfield, terrain.size, params);
    const centerHeight = terrain.heightAtLocal(0, 0);
    for (let i = 0; i < heightfield.heights.length; i++)
        heightfield.heights[i] -= centerHeight;
    const stamp: Stamp = {
        cx: terrain.localToGrid(0),
        cz: terrain.localToGrid(0),
        radius: CLEARING_RADIUS / terrain.cellSize,
        falloff: 'flat',
        region: terrain.gridRegionAround(0, 0, CLEARING_RADIUS, { x0: 0, z0: 0, x1: 0, z1: 0 }),
    };
    sculptFlatten(heightfield, stamp, 0, 1);
    terrain.heightsChanged();
    autoPaintTerrain(terrain);
    return terrain;
}
export function createDefaultScene(materials: TerrainMaterialLibrary): Scene {
    const scene = new Scene('Cena_Principal');
    const { sky } = scene;
    const lighting = scene.createEntity({ name: 'Iluminação', kind: 'group' });
    const sun = scene.createEntity({ name: 'LuzDirecional', kind: 'light', light: createDirectionalLight() }, lighting);
    vec3.set(sun.transform.position, 4, 8, 3);
    const sunDirection = sunDirectionFromTime(vec3.create(), sky.timeOfDay, sky.latitude, sky.sunAzimuth);
    sunRotationFromDirection(sun.transform.rotation, sunDirection);
    scene.createEntity({ name: 'LuzAmbiente', kind: 'light', light: createAmbientLight() }, lighting);
    const camera = scene.createEntity({ name: 'CameraPrincipal', kind: 'camera' });
    vec3.set(camera.transform.position, -6, 4, 6);
    vec3.set(camera.transform.rotation, -25, -45, 0);
    scene.createEntity({ name: 'Terreno', kind: 'terrain', terrain: createDemoTerrain(materials) });
    const geometry = scene.createEntity({ name: 'Geometria', kind: 'group' });
    const floor = scene.createEntity({
        name: 'Chão',
        kind: 'mesh',
        mesh: createPlane(12, 12),
        material: material(0.075, 0.078, 0.085, 0.9),
        castShadows: false,
    }, geometry);
    vec3.set(floor.transform.position, 0, -0.03, 0);
    const cube = scene.createEntity({ name: 'Cubo', kind: 'mesh', mesh: createBox(1.2, 1.2, 1.2), material: material(0.72, 0.42, 0.2, 0.5) }, geometry);
    vec3.set(cube.transform.position, 0, 0.6, 0);
    vec3.set(cube.transform.rotation, 0, 20, 0);
    const sphere = scene.createEntity({ name: 'Esfera', kind: 'mesh', mesh: createSphere(0.7), material: material(0.26, 0.5, 0.78, 0.2) }, geometry);
    vec3.set(sphere.transform.position, 2.4, 0.7, -1.2);
    const cylinder = scene.createEntity({ name: 'Cilindro', kind: 'mesh', mesh: createCylinder(0.5, 1.6), material: material(0.42, 0.66, 0.38, 0.6) }, geometry);
    vec3.set(cylinder.transform.position, -2.2, 0.8, 1.4);
    const pillar = scene.createEntity({ name: 'Pilar', kind: 'mesh', mesh: createBox(0.6, 3, 0.6), material: material(0.6, 0.6, 0.62, 0.3, 1) }, geometry);
    vec3.set(pillar.transform.position, -3.5, 1.5, -3);
    const stack = scene.createEntity({ name: 'Pilha', kind: 'group' }, geometry);
    vec3.set(stack.transform.position, 2.6, 0, 2.2);
    for (let level = 0; level < STACK_LEVELS; level++) {
        const box = scene.createEntity({
            name: `Caixa_${level + 1}`,
            kind: 'mesh',
            mesh: createBox(STACK_BOX_SIZE, STACK_BOX_SIZE, STACK_BOX_SIZE),
            material: material(0.78 - level * 0.08, 0.62 - level * 0.05, 0.42, 0.7),
        }, stack);
        vec3.set(box.transform.position, (level % 2) * 0.12, STACK_BOX_SIZE * (level + 0.5), (level % 2) * -0.08);
        vec3.set(box.transform.rotation, 0, level * 9, 0);
        box.rigidBody = createRigidBodyForEntity(box);
    }
    floor.rigidBody = createRigidBodyForEntity(floor, { type: 'static', friction: 0.8 });
    cube.rigidBody = createRigidBodyForEntity(cube);
    sphere.rigidBody = createRigidBodyForEntity(sphere, { restitution: 0.4 });
    cylinder.rigidBody = createRigidBodyForEntity(cylinder);
    pillar.rigidBody = createRigidBodyForEntity(pillar);
    return scene;
}
