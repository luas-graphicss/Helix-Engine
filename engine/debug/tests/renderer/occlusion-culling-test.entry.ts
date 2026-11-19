import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { Scene } from '@/engine/core/scene/scene';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { VisibleSet, type CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { raycastMesh } from '@/engine/renderer/geometry/mesh-raycast';
import { transformMeshData } from '@/engine/renderer/geometry/mesh-transform';
import { createBox, createSphere } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const VIEWPORT_HEIGHT = 720;
const OCCLUSION_ON: CullingOptions = { frustumCulling: true, minPixelSize: 0, occlusionCulling: true, lodGroups: true };
const OCCLUSION_OFF: CullingOptions = { ...OCCLUSION_ON, occlusionCulling: false };
const RANDOM_SCENES = 40;
const RANDOM_OCCLUDERS = 6;
const RANDOM_PROPS = 30;
const RAY_MARGIN = 1e-3;
const checks = createCheckList('Descarte por oclusão');
function createRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
}
function createCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera();
    vec3.set(camera.position, 0, 0, 0);
    vec3.set(camera.target, 0, 0, -1);
    camera.aspect = 16 / 9;
    camera.updateMatrices();
    return camera;
}
function place(scene: Scene, name: string, mesh: MeshData, x: number, y: number, z: number): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh });
    vec3.set(entity.transform.position, x, y, z);
    return entity;
}
function collect(scene: Scene, options: CullingOptions): VisibleSet {
    scene.updateWorldMatrices();
    const visible = new VisibleSet();
    visible.collect(scene, createCamera(), VIEWPORT_HEIGHT, options);
    return visible;
}
function names(visible: VisibleSet): Set<string> {
    return new Set(visible.meshes.map((item) => item.entity.name));
}
function wallScene(): Scene {
    const scene = new Scene();
    place(scene, 'wall', createBox(12, 8, 0.5), 0, 0, -10);
    place(scene, 'behind', createBox(1, 1, 1), 0, 0, -20);
    place(scene, 'in front', createBox(1, 1, 1), 0, 0, -5);
    place(scene, 'peeking', createBox(1, 1, 1), 12.5, 0, -20);
    return scene;
}
function wall(): void {
    const visible = collect(wallScene(), OCCLUSION_ON);
    const drawn = names(visible);
    checks.check('a parede continua desenhada', drawn.has('wall'));
    checks.check('a caixa inteira atrás da parede é descartada', !drawn.has('behind'));
    checks.check('a caixa diante da parede continua desenhada', drawn.has('in front'));
    checks.check('a caixa que aparece além da borda da parede continua desenhada', drawn.has('peeking'));
    checks.check('as estatísticas contam a malha descartada', visible.stats.occlusionCulled === 1 && visible.stats.visible === 3);
    checks.check('as estatísticas contam os oclusores usados', visible.stats.occluders >= 1 && visible.stats.occluderTriangles >= 12);
}
function disabled(): void {
    const visible = collect(wallScene(), OCCLUSION_OFF);
    checks.check('desligado, nada é descartado por oclusão', visible.meshes.length === 4 && visible.stats.occlusionCulled === 0);
}
function translucentWall(): void {
    const scene = new Scene();
    const glass = place(scene, 'glass', createBox(12, 8, 0.5), 0, 0, -10);
    glass.material = createMaterial({ alphaMode: 'blend', opacity: 0.4 });
    place(scene, 'behind', createBox(1, 1, 1), 0, 0, -20);
    checks.check('uma parede translúcida não esconde o que está atrás', names(collect(scene, OCCLUSION_ON)).has('behind'));
}
function wallAcrossNearPlane(): void {
    const scene = new Scene();
    place(scene, 'corridor wall', createBox(0.5, 8, 40), 3, 0, 0);
    place(scene, 'beyond', createBox(1, 1, 1), 8, 0, -10);
    place(scene, 'inside', createBox(1, 1, 1), 0, 0, -10);
    const drawn = names(collect(scene, OCCLUSION_ON));
    checks.check('uma parede que atravessa o plano próximo ainda esconde o que está além dela', !drawn.has('beyond'));
    checks.check('o que está do lado de cá da parede continua desenhado', drawn.has('inside'));
}
function roundOccluder(): void {
    const scene = new Scene();
    place(scene, 'sphere', createSphere(2), 0, 0, -10);
    place(scene, 'behind centre', createBox(0.2, 0.2, 0.2), 0, 0, -20);
    place(scene, 'behind corner', createBox(0.2, 0.2, 0.2), 4.4, 4.4, -20);
    const drawn = names(collect(scene, OCCLUSION_ON));
    checks.check('uma esfera esconde o que está atrás do seu centro', !drawn.has('behind centre'));
    checks.check('uma esfera não esconde o que só a sua caixa envolvente cobre', drawn.has('behind corner'));
}
function silhouetteSweep(): void {
    let wronglyHidden = 0;
    let hidden = 0;
    for (let x = 0; x <= 16; x += 0.25) {
        const scene = new Scene();
        place(scene, 'wall', createBox(12, 8, 0.5), 0, 0, -10);
        place(scene, 'probe', createBox(0.5, 0.5, 0.5), x, 0, -20);
        const isHidden = !names(collect(scene, OCCLUSION_ON)).has('probe');
        const farEdgeRatio = (x + 0.25) / 19.75;
        const silhouetteRatio = 6 / 9.75;
        if (isHidden)
            hidden++;
        if (isHidden && farEdgeRatio > silhouetteRatio)
            wronglyHidden++;
    }
    checks.check('nenhuma caixa com parte fora da silhueta da parede é descartada', wronglyHidden === 0, `${wronglyHidden} descartada(s) com parte visível`);
    checks.check('as caixas bem atrás da parede são descartadas', hidden >= 30, `${hidden} descartada(s)`);
}
function randomScene(random: () => number): Scene {
    const scene = new Scene();
    const between = (min: number, max: number) => min + (max - min) * random();
    for (let index = 0; index < RANDOM_OCCLUDERS; index++) {
        const depth = between(6, 30);
        const occluder = place(scene, `occluder ${index}`, createBox(between(2, 10), between(2, 10), between(0.3, 3)), between(-0.8, 0.8) * depth, between(-0.4, 0.4) * depth, -depth);
        vec3.set(occluder.transform.rotation, between(-20, 20), between(-60, 60), between(-20, 20));
    }
    for (let index = 0; index < RANDOM_PROPS; index++) {
        const depth = between(8, 60);
        const size = between(0.3, 1.5);
        place(scene, `prop ${index}`, createBox(size, size, size), between(-0.9, 0.9) * depth, between(-0.5, 0.5) * depth, -depth);
    }
    return scene;
}
function hasVisibleVertex(target: Entity, others: readonly MeshData[], camera: PerspectiveCamera): boolean {
    const world = transformMeshData(target.mesh as MeshData, target.worldMatrix);
    const m = camera.viewProjectionMatrix;
    const direction = vec3.create();
    const ray = { origin: camera.position, direction };
    for (let offset = 0; offset < world.positions.length; offset += 3) {
        const x = world.positions[offset];
        const y = world.positions[offset + 1];
        const z = world.positions[offset + 2];
        const w = m[3] * x + m[7] * y + m[11] * z + m[15];
        const onScreen = w > camera.near && Math.abs(m[0] * x + m[4] * y + m[8] * z + m[12]) <= w && Math.abs(m[1] * x + m[5] * y + m[9] * z + m[13]) <= w;
        if (!onScreen)
            continue;
        vec3.set(direction, x - camera.position[0], y - camera.position[1], z - camera.position[2]);
        const distance = vec3.length(direction);
        vec3.scale(direction, direction, 1 / distance);
        if (!others.some((mesh) => raycastMesh(ray, mesh, distance - RAY_MARGIN) !== null))
            return true;
    }
    return false;
}
function randomScenes(): void {
    const random = createRandom(20261118);
    const camera = createCamera();
    let culled = 0;
    let wronglyCulled = 0;
    for (let index = 0; index < RANDOM_SCENES; index++) {
        const scene = randomScene(random);
        const drawn = names(collect(scene, OCCLUSION_ON));
        const entities = collect(scene, OCCLUSION_OFF).meshes.map((item) => item.entity);
        const worldMeshes = new Map(entities.map((entity) => [entity, transformMeshData(entity.mesh as MeshData, entity.worldMatrix)]));
        for (const entity of entities) {
            if (drawn.has(entity.name))
                continue;
            culled++;
            const others = entities.filter((other) => other !== entity).map((other) => worldMeshes.get(other) as MeshData);
            if (hasVisibleVertex(entity, others, camera))
                wronglyCulled++;
        }
    }
    checks.check('em cenas aleatórias, nenhuma malha com vértice à vista é descartada', wronglyCulled === 0, `${wronglyCulled} de ${culled} descartada(s) por engano`);
    checks.check('em cenas aleatórias, a oclusão descarta malhas escondidas', culled >= RANDOM_SCENES, `${culled} descartada(s)`);
}
wall();
disabled();
translucentWall();
wallAcrossNearPlane();
roundOccluder();
silhouetteSweep();
randomScenes();
checks.finish();
