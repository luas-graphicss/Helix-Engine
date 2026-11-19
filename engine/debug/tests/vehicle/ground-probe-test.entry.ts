import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat4 from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { createBoxShape, createCapsuleShape, createHeightfieldShape, createMeshShape, createSphereShape, type ColliderShape, type HeightfieldSource } from '@/engine/physics/shapes/collider-shape';
import { createPhysicsSettings } from '@/engine/physics/world/physics-settings';
import { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { createPlane } from '@/engine/renderer/geometry/primitives';
import { Heightfield } from '@/engine/terrain/core/heightfield';
import { createGroundHit, GroundProbe } from '@/engine/vehicle/ground/ground-probe';
import { createCheckList } from '../support/check-list';
const TOLERANCE = 1e-3;
const DOWN = vec3.create(0, -1, 0);
const UP = [0, 1, 0];
const SLOPE_RESOLUTION = 9;
const SLOPE_SIZE = 8;
const SLOPE_RISE_PER_CELL = 0.5;
const checks = createCheckList('Sonda de chão das rodas');
const world = new PhysicsWorld(createPhysicsSettings());
function addStatic(shape: ColliderShape, position: Vec3, orientation = quat.create()): RigidBody {
    return world.createBody({ type: 'static', shape, position, orientation, mass: 0, friction: 0.6, restitution: 0, linearDamping: 0, angularDamping: 0, gravityScale: 1, canSleep: true });
}
function createSlope(): HeightfieldSource {
    const heightfield = new Heightfield(SLOPE_RESOLUTION);
    for (let z = 0; z < SLOPE_RESOLUTION; z++)
        for (let x = 0; x < SLOPE_RESOLUTION; x++)
            heightfield.set(x, z, x * SLOPE_RISE_PER_CELL);
    const half = SLOPE_SIZE / 2;
    const localBounds = aabb.create();
    vec3.set(localBounds.min, -half, 0, -half);
    vec3.set(localBounds.max, half, (SLOPE_RESOLUTION - 1) * SLOPE_RISE_PER_CELL, half);
    return { heightfield, resolution: SLOPE_RESOLUTION, cellSize: SLOPE_SIZE / (SLOPE_RESOLUTION - 1), halfSize: half, localBounds };
}
const chassis = world.createBody({ type: 'dynamic', shape: createBoxShape(1, 0.25, 2), position: vec3.create(0, 2, 0), orientation: quat.create(), mass: 1000, friction: 0.6, restitution: 0, linearDamping: 0, angularDamping: 0, gravityScale: 1, canSleep: true });
const floor = addStatic(createBoxShape(2, 0.5, 2), vec3.create(0, 0, 0));
const ball = addStatic(createSphereShape(1), vec3.create(10, 0, 0));
const pillar = addStatic(createCapsuleShape(0.5, 1), vec3.create(20, 0, 0));
const tilted = addStatic(createBoxShape(1, 1, 1), vec3.create(30, 0, 0), quat.fromAxisAngle(quat.create(), vec3.create(0, 0, 1), Math.PI / 4));
const planeShape = createMeshShape(createPlane(4, 4, 1), vec3.create(1, 1, 1));
const slopeShape = createHeightfieldShape(createSlope(), mat4.fromTranslationRotationScale(mat4.create(), vec3.create(50, 0, 0), vec3.create(), vec3.create(1, 1, 1)));
if (!planeShape || !slopeShape)
    throw new Error('Ground probe fixtures could not be built');
const deck = addStatic(planeShape, vec3.create(40, 1, 0));
const slope = addStatic(slopeShape, vec3.create(50, 0, 0));
const probe = new GroundProbe(world);
const hit = createGroundHit();
function castDown(x: number, y: number, z: number, reach: number): boolean {
    return probe.cast(vec3.create(x, y, z), DOWN, reach, chassis, hit);
}
checks.check('raio acerta a caixa abaixo da roda', castDown(0.5, 3, 0.5, 5) && hit.body === floor);
checks.near('distância até o topo da caixa', hit.distance, 2.5, TOLERANCE);
checks.nearAll('normal da caixa aponta para cima', hit.normal, UP, TOLERANCE);
checks.nearAll('ponto de contato fica na superfície', hit.point, [0.5, 0.5, 0.5], TOLERANCE);
checks.check('raio curto demais não alcança o chão', !castDown(0.5, 3, 0.5, 2) && hit.body === null);
checks.check('o próprio chassi é ignorado', castDown(0, 4, 0, 5) && hit.body === floor);
checks.check('raio acerta a esfera', castDown(10, 5, 0, 10) && hit.body === ball);
checks.near('distância até o topo da esfera', hit.distance, 4, TOLERANCE);
checks.check('raio acerta a tampa da cápsula', castDown(20, 5, 0, 10) && hit.body === pillar);
checks.near('distância até o topo da cápsula', hit.distance, 3.5, TOLERANCE);
checks.check('raio lateral acerta o corpo da cápsula', probe.cast(vec3.create(25, 0, 0), vec3.create(-1, 0, 0), 10, chassis, hit) && hit.body === pillar);
checks.near('distância até a lateral da cápsula', hit.distance, 4.5, TOLERANCE);
checks.nearAll('normal lateral da cápsula', hit.normal, [1, 0, 0], TOLERANCE);
checks.check('raio acerta a caixa girada', castDown(30, 5, 0, 10) && hit.body === tilted);
checks.near('distância até a aresta da caixa girada', hit.distance, 5 - Math.SQRT2, TOLERANCE);
checks.near('normal da caixa girada acompanha a face inclinada', hit.normal[1], Math.SQRT1_2, TOLERANCE);
checks.check('raio acerta a malha estática', castDown(40.3, 4, 0.2, 10) && hit.body === deck);
checks.near('distância até a malha', hit.distance, 3, TOLERANCE);
checks.nearAll('normal da malha aponta contra o raio', hit.normal, UP, TOLERANCE);
checks.check('raio acerta o terreno inclinado', castDown(50, 10, 0, 20) && hit.body === slope);
checks.near('distância até o terreno', hit.distance, 8, 1e-2);
checks.nearAll('normal do terreno segue a rampa', hit.normal, [-SLOPE_RISE_PER_CELL / Math.hypot(SLOPE_RISE_PER_CELL, 1), 1 / Math.hypot(SLOPE_RISE_PER_CELL, 1), 0], 1e-2);
checks.check('raio fora do terreno não acerta nada', !castDown(60, 10, 0, 20));
const crate = addStatic(createBoxShape(0.5, 0.5, 0.5), vec3.create(0, 1.5, 0));
checks.check('o colisor mais próximo vence', castDown(0, 4, 0, 5) && hit.body === crate);
checks.near('distância até o colisor mais próximo', hit.distance, 2, TOLERANCE);
checks.check('roda dentro de um colisor conta como contato imediato', castDown(0, 1.5, 0, 1) && hit.body === crate && hit.distance === 0);
checks.finish();
