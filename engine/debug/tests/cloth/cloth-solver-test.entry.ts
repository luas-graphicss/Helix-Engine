import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { getClothPreset } from '@/engine/cloth/cloth-presets';
import { createClothSettings, type ClothSettings } from '@/engine/cloth/cloth-settings';
import { createBoxCollider, createCapsuleCollider, createHeightfieldCollider, createSphereCollider, type ClothCollider } from '@/engine/cloth/collision/cloth-collider';
import { createFlatSheet, createHangingSheet } from '@/engine/cloth/mesh/cloth-shapes';
import { buildClothTopology } from '@/engine/cloth/mesh/cloth-topology';
import { ClothInstance } from '@/engine/cloth/runtime/cloth-instance';
import { restMeshOf } from '@/engine/cloth/runtime/cloth-rest-meshes';
import { CLOTH_QUALITY_SUBSTEPS } from '@/engine/cloth/solver/solver-parameters';
import * as aabb from '@/engine/core/math/aabb';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createCheckList } from '../support/check-list';
const STEP_SECONDS = 1 / 60;
const GRAVITY = vec3.create(0, -9.81, 0);
const THICKNESS = 0.02;
const CONTACT_SLACK = 2e-3;
const UNIT_AXES = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const checks = createCheckList('Solver de tecido');
interface Fixture {
    readonly scene: Scene;
    readonly entity: Entity;
    readonly instance: ClothInstance;
    readonly rest: MeshData;
}
function createFixture(rest: MeshData, settings: ClothSettings, height = 0): Fixture {
    const scene = new Scene('Teste');
    const entity = scene.createEntity({ name: 'cloth', kind: 'mesh', mesh: rest });
    entity.transform.position[1] = height;
    scene.updateWorldMatrices();
    return { scene, entity, instance: new ClothInstance(entity, rest, settings), rest };
}
function simulate(instance: ClothInstance, seconds: number, colliders: readonly ClothCollider[] = []): void {
    const steps = Math.round(seconds / STEP_SECONDS);
    for (let step = 0; step < steps; step++)
        instance.step(STEP_SECONDS, { gravity: GRAVITY, colliders, time: step * STEP_SECONDS });
    instance.writeMesh();
}
function column(mesh: MeshData, axis: number): number[] {
    return Array.from(mesh.positions).filter((_, index) => index % 3 === axis);
}
function mean(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0) / values.length;
}
function worldPoints(fixture: Fixture): number[][] {
    const { positions } = fixture.instance.mesh;
    const offset = fixture.entity.transform.position;
    const points: number[][] = [];
    for (let index = 0; index < positions.length; index += 3)
        points.push([positions[index] + offset[0], positions[index + 1] + offset[1], positions[index + 2] + offset[2]]);
    return points;
}
function largestStrain(rest: MeshData, simulated: MeshData): number {
    let largest = 0;
    for (let corner = 0; corner < rest.indices.length; corner += 3) {
        for (let edge = 0; edge < 3; edge++) {
            const a = rest.indices[corner + edge] * 3;
            const b = rest.indices[corner + ((edge + 1) % 3)] * 3;
            const restLength = Math.hypot(rest.positions[b] - rest.positions[a], rest.positions[b + 1] - rest.positions[a + 1], rest.positions[b + 2] - rest.positions[a + 2]);
            const length = Math.hypot(simulated.positions[b] - simulated.positions[a], simulated.positions[b + 1] - simulated.positions[a + 1], simulated.positions[b + 2] - simulated.positions[a + 2]);
            largest = Math.max(largest, Math.abs(length - restLength) / restLength);
        }
    }
    return largest;
}
function averageFolding(rest: MeshData, simulated: MeshData): number {
    const { bendPairs } = buildClothTopology(rest);
    let total = 0;
    for (let pair = 0; pair < bendPairs.length; pair += 2) {
        const a = bendPairs[pair] * 3;
        const b = bendPairs[pair + 1] * 3;
        const restLength = Math.hypot(rest.positions[b] - rest.positions[a], rest.positions[b + 1] - rest.positions[a + 1], rest.positions[b + 2] - rest.positions[a + 2]);
        const length = Math.hypot(simulated.positions[b] - simulated.positions[a], simulated.positions[b + 1] - simulated.positions[a + 1], simulated.positions[b + 2] - simulated.positions[a + 2]);
        total += Math.max(0, 1 - length / restLength);
    }
    return total / (bendPairs.length / 2);
}
function allFinite(mesh: MeshData): boolean {
    return mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite);
}
const inert = createClothSettings({ airDrag: 0, damping: 0, collideWithBodies: false });
const falling = createFixture(createFlatSheet('falling', { width: 1, length: 1, columns: 6, rows: 6 }), inert);
const fallSeconds = 0.5;
const substepSeconds = STEP_SECONDS / CLOTH_QUALITY_SUBSTEPS[inert.quality];
simulate(falling.instance, fallSeconds);
const fallen = column(falling.instance.mesh, 1);
const expectedFall = -0.5 * 9.81 * fallSeconds * (fallSeconds + substepSeconds);
checks.check('a simulação troca a malha do ator por uma cópia dinâmica', falling.entity.mesh === falling.instance.mesh && falling.instance.mesh !== falling.rest && falling.instance.mesh.dynamic === true);
checks.check('a cópia dinâmica aponta para a malha de repouso', restMeshOf(falling.instance.mesh) === falling.rest && restMeshOf(falling.rest) === falling.rest);
checks.check('cada passo escrito marca a malha como alterada', getMeshVersion(falling.instance.mesh) === 1);
checks.near('pano solto cai em queda livre', mean(fallen), expectedFall, 2e-3);
checks.check('a queda livre não deforma o pano', Math.max(...fallen) - Math.min(...fallen) < 1e-3 && largestStrain(falling.rest, falling.instance.mesh) < 1e-3);
checks.check('a malha de repouso fica intacta', column(falling.rest, 1).every((height) => height === 0));
const sheet = { width: 1, length: 1.2, columns: 12, rows: 14 };
const hanging = createFixture(createHangingSheet('hanging', sheet), createClothSettings({ anchor: 'top' }));
simulate(hanging.instance, 3);
const hangingRest = hanging.rest.positions;
const hangingNow = hanging.instance.mesh.positions;
let anchorDrift = 0;
for (let index = 0; index < hangingRest.length; index += 3) {
    if (hangingRest[index + 1] !== sheet.length / 2)
        continue;
    anchorDrift = Math.max(anchorDrift, Math.abs(hangingNow[index] - hangingRest[index]), Math.abs(hangingNow[index + 1] - hangingRest[index + 1]), Math.abs(hangingNow[index + 2] - hangingRest[index + 2]));
}
checks.check('a borda presa não sai do lugar', hanging.instance.anchoredCount === sheet.columns + 1 && anchorDrift < 1e-5);
checks.check('pano firme pendurado quase não estica', largestStrain(hanging.rest, hanging.instance.mesh) < 0.03, `esticou ${largestStrain(hanging.rest, hanging.instance.mesh)}`);
checks.check('as normais saem unitárias', Array.from({ length: hangingNow.length / 3 }, (_, vertex) => Math.hypot(hanging.instance.mesh.normals[vertex * 3], hanging.instance.mesh.normals[vertex * 3 + 1], hanging.instance.mesh.normals[vertex * 3 + 2])).every((length) => Math.abs(length - 1) < 1e-3));
const elastic = createFixture(createHangingSheet('elastic', sheet), createClothSettings({ anchor: 'top', stretchStiffness: 0 }));
simulate(elastic.instance, 3);
checks.check('pouca resistência a esticar alonga o pano', Math.min(...column(elastic.instance.mesh, 1)) < Math.min(...column(hanging.instance.mesh, 1)) - 0.02);
const flagShape = { width: 1.5, length: 1, columns: 30, rows: 20 };
const flagSettings = getClothPreset('flag').settings;
const freeEdge = (mesh: MeshData, axis: number): number => {
    const values: number[] = [];
    for (let vertex = flagShape.columns; vertex < mesh.positions.length / 3; vertex += flagShape.columns + 1)
        values.push(mesh.positions[vertex * 3 + axis]);
    return mean(values);
};
const windy = createFixture(createHangingSheet('windy', flagShape), flagSettings);
const calm = createFixture(createHangingSheet('calm', flagShape), { ...flagSettings, windSpeed: 0 });
const sideways = createFixture(createHangingSheet('sideways', flagShape), { ...flagSettings, windDirection: 90 });
simulate(windy.instance, 4);
simulate(calm.instance, 4);
simulate(sideways.instance, 4);
checks.check('o vento mantém a bandeira estendida', freeEdge(windy.instance.mesh, 0) > freeEdge(calm.instance.mesh, 0) + 0.15, `com vento ${freeEdge(windy.instance.mesh, 0)}, sem vento ${freeEdge(calm.instance.mesh, 0)}`);
checks.check('o vento sustenta a ponta da bandeira', freeEdge(windy.instance.mesh, 1) > freeEdge(calm.instance.mesh, 1) + 0.1, `com vento ${freeEdge(windy.instance.mesh, 1)}, sem vento ${freeEdge(calm.instance.mesh, 1)}`);
checks.check('as rajadas fazem a bandeira ondular', Math.max(...column(windy.instance.mesh, 2).map(Math.abs)) > 0.01);
checks.check('a direção do vento leva a bandeira junto', freeEdge(sideways.instance.mesh, 2) > 0.2, `ponta em z = ${freeEdge(sideways.instance.mesh, 2)}`);
checks.check('a bandeira ao vento continua inteira', allFinite(windy.instance.mesh) && largestStrain(windy.rest, windy.instance.mesh) < 0.15, `esticou ${largestStrain(windy.rest, windy.instance.mesh)}`);
const drape = { width: 1.6, length: 1.6, columns: 20, rows: 20 };
const colliding = createClothSettings({ thickness: THICKNESS, friction: 0.6 });
const overSphere = createFixture(createFlatSheet('sphere', drape), colliding, 0.9);
simulate(overSphere.instance, 3, [createSphereCollider(vec3.create(0, 0, 0), 0.5)]);
const sphereClearance = Math.min(...worldPoints(overSphere).map(([x, y, z]) => Math.hypot(x, y, z)));
checks.check('o pano não atravessa a esfera', sphereClearance >= 0.5 + THICKNESS - CONTACT_SLACK, `distância mínima ${sphereClearance}`);
checks.check('o pano se molda à esfera', Math.min(...worldPoints(overSphere).map((point) => point[1])) < 0.3 && largestStrain(overSphere.rest, overSphere.instance.mesh) < 0.1);
const stiffDrape = createFixture(createFlatSheet('stiff', drape), { ...colliding, bendStiffness: 1 }, 0.9);
const softDrape = createFixture(createFlatSheet('soft', drape), { ...colliding, bendStiffness: 0 }, 0.9);
simulate(stiffDrape.instance, 3, [createSphereCollider(vec3.create(0, 0, 0), 0.5)]);
simulate(softDrape.instance, 3, [createSphereCollider(vec3.create(0, 0, 0), 0.5)]);
const stiffFolding = averageFolding(stiffDrape.rest, stiffDrape.instance.mesh);
const softFolding = averageFolding(softDrape.rest, softDrape.instance.mesh);
checks.check('resistência a dobrar deixa o pano mais liso', stiffFolding < softFolding * 0.5, `firme ${stiffFolding}, mole ${softFolding}`);
const overBox = createFixture(createFlatSheet('box', drape), colliding, 0.9);
simulate(overBox.instance, 3, [createBoxCollider(vec3.create(0, 0, 0), UNIT_AXES, vec3.create(0.5, 0.5, 0.5))]);
const boxReach = 0.5 + THICKNESS - CONTACT_SLACK;
checks.check('o pano não atravessa a caixa', worldPoints(overBox).every(([x, y, z]) => Math.abs(x) >= boxReach || Math.abs(y) >= boxReach || Math.abs(z) >= boxReach));
checks.check('o pano descansa sobre a caixa e cai pelas bordas', Math.max(...worldPoints(overBox).map((point) => point[1])) < 0.6 && Math.min(...worldPoints(overBox).map((point) => point[1])) < 0.3);
const overCapsule = createFixture(createFlatSheet('capsule', drape), colliding, 0.9);
simulate(overCapsule.instance, 3, [createCapsuleCollider(vec3.create(-0.4, 0, 0), vec3.create(0.4, 0, 0), 0.3)]);
const capsuleClearance = Math.min(...worldPoints(overCapsule).map(([x, y, z]) => Math.hypot(x - Math.min(Math.max(x, -0.4), 0.4), y, z)));
checks.check('o pano não atravessa a cápsula', capsuleClearance >= 0.3 + THICKNESS - CONTACT_SLACK, `distância mínima ${capsuleClearance}`);
const groundHeight = (x: number, z: number): number => 0.2 * Math.sin(x * 2) * Math.cos(z * 2);
const ground = aabb.create();
vec3.set(ground.min, -10, -1, -10);
vec3.set(ground.max, 10, 1, 10);
const overGround = createFixture(createFlatSheet('ground', drape), colliding, 0.9);
simulate(overGround.instance, 3, [createHeightfieldCollider(ground, groundHeight)]);
checks.check('o pano não afunda no terreno', worldPoints(overGround).every(([x, y, z]) => y >= groundHeight(x, z) + THICKNESS - CONTACT_SLACK));
checks.check('o pano pousa acompanhando o relevo', Math.max(...worldPoints(overGround).map((point) => point[1])) < 0.3);
const ghost = createFixture(createFlatSheet('ghost', drape), { ...colliding, collideWithBodies: false }, 0.9);
simulate(ghost.instance, 1, [createSphereCollider(vec3.create(0, 0, 0), 0.5)]);
checks.check('sem colisão o pano atravessa os corpos', Math.max(...worldPoints(ghost).map((point) => point[1])) < -0.5);
const carried = createFixture(createHangingSheet('carried', sheet), createClothSettings({ anchor: 'top', damping: 0.5 }));
const carrySteps = 60;
const carryDistance = 2;
const trailing = (): number[] => column(carried.instance.mesh, 0).map((x, vertex) => x - carried.rest.positions[vertex * 3]);
let largestLag = 0;
for (let step = 0; step < carrySteps; step++) {
    carried.entity.transform.position[0] = (carryDistance * (step + 1)) / carrySteps;
    carried.scene.updateWorldMatrices();
    carried.instance.step(STEP_SECONDS, { gravity: GRAVITY, colliders: [], time: step * STEP_SECONDS });
    carried.instance.writeMesh();
    largestLag = Math.min(largestLag, ...trailing());
}
checks.check('o pano fica para trás quando o ator arranca', largestLag < -0.1, `maior atraso ${largestLag}`);
simulate(carried.instance, 4);
checks.check('o pano alcança o ator quando ele para', Math.max(...trailing().map(Math.abs)) < 0.1, `maior afastamento ${Math.max(...trailing().map(Math.abs))}`);
const storm = createFixture(createHangingSheet('storm', flagShape), createClothSettings({ anchor: 'left', quality: 'low', density: 0.05, windSpeed: 40, windTurbulence: 1, airDrag: 4, stretchStiffness: 1, bendStiffness: 0 }));
simulate(storm.instance, 5);
checks.check('vento extremo em pano leve continua estável', allFinite(storm.instance.mesh) && Math.max(...Array.from(storm.instance.mesh.positions).map(Math.abs)) < 5, `maior coordenada ${Math.max(...Array.from(storm.instance.mesh.positions).map(Math.abs))}`);
const versionBeforeTuning = getMeshVersion(hanging.instance.mesh);
hanging.instance.applySettings(createClothSettings({ anchor: 'corners' }));
checks.check('trocar a fixação reaproveita a simulação em curso', hanging.instance.anchoredCount === 4 && getMeshVersion(hanging.instance.mesh) === versionBeforeTuning);
hanging.instance.dispose();
checks.check('encerrar a simulação devolve a malha de repouso ao ator', hanging.entity.mesh === hanging.rest && column(hanging.rest, 2).every((depth) => depth === 0));
checks.finish();
