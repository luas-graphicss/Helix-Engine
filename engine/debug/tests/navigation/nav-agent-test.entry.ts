import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { NavAgent } from '@/engine/navigation/agent/nav-agent';
import { createNavAgentSettings, type NavAgentSettings } from '@/engine/navigation/agent/nav-agent-settings';
import { JUMP_AREA, WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { bakeNavMesh, type NavBakeSettings } from '@/engine/navigation/bake/bake-nav-mesh';
import { TriangleSoupBuilder } from '@/engine/navigation/bake/triangle-soup';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { NavObstacle } from '@/engine/navigation/world/nav-obstacle';
import { NavigationWorld } from '@/engine/navigation/world/navigation-world';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const SETTINGS: NavBakeSettings = { agentRadius: 0.5, agentHeight: 2, maxSlope: 45, stepHeight: 0.4, cellSize: 0.25, minRegionArea: 2 };
const STEP = 1 / 60;
const TIMEOUT_SECONDS = 30;
const checks = createCheckList('Agentes no NavMesh');
const world4 = mat4.create();
const NO_ROTATION = vec3.create();
const UNIT_SCALE = vec3.create(1, 1, 1);
let nextId = 1;
function addBox(soup: TriangleSoupBuilder, size: readonly [number, number, number], center: readonly [number, number, number]): void {
    mat4.fromTranslationRotationScale(world4, vec3.create(center[0], center[1], center[2]), NO_ROTATION, UNIT_SCALE);
    soup.addMesh(createBox(size[0], size[1], size[2]), world4, WALKABLE_AREA);
}
function bake(build: (soup: TriangleSoupBuilder) => void): NavMesh {
    const soup = new TriangleSoupBuilder();
    build(soup);
    const mesh = bakeNavMesh({ triangles: soup, heightSources: [], areaVolumes: [], minX: soup.min[0], maxX: soup.max[0], minZ: soup.min[2], maxZ: soup.max[2], minHeight: -Infinity, maxHeight: Infinity }, SETTINGS);
    if (!mesh)
        throw new Error('The bake produced no walkable polygon.');
    return mesh;
}
function openFloor(soup: TriangleSoupBuilder): void {
    addBox(soup, [20, 1, 20], [0, -0.5, 0]);
}
function createWorld(mesh: NavMesh): NavigationWorld {
    const world = new NavigationWorld();
    world.setMeshes([mesh]);
    return world;
}
function spawn(world: NavigationWorld, x: number, z: number, overrides: Partial<NavAgentSettings> = {}): NavAgent {
    const agent = new NavAgent(nextId++, createNavAgentSettings(overrides));
    vec3.set(agent.position, x, 0, z);
    world.addAgent(agent);
    return agent;
}
function runUntil(world: NavigationWorld, isDone: () => boolean, observe: () => void = () => undefined): number {
    let elapsed = 0;
    while (elapsed < TIMEOUT_SECONDS && !isDone()) {
        world.step(STEP);
        observe();
        elapsed += STEP;
    }
    return elapsed;
}
function flatDistance(from: Vec3, to: Vec3): number {
    return Math.hypot(to[0] - from[0], to[2] - from[2]);
}
const straightWorld = createWorld(bake(openFloor));
const walker = spawn(straightWorld, -8, -8);
const goal = vec3.create(8, 0, 8);
let arrivals = 0;
let topSpeed = 0;
straightWorld.onArrived = () => arrivals++;
walker.setDestination(goal);
const straightSeconds = runUntil(straightWorld, () => walker.hasArrived, () => {
    topSpeed = Math.max(topSpeed, Math.hypot(walker.velocity[0], walker.velocity[2]));
});
checks.check('agente chega ao destino em piso livre', walker.hasArrived && flatDistance(walker.position, goal) <= walker.settings.stoppingDistance + 0.05, `a ${flatDistance(walker.position, goal).toFixed(3)} m`);
checks.check('chegada é avisada uma única vez', arrivals === 1, `${arrivals} avisos`);
checks.check('agente respeita a velocidade máxima', topSpeed <= walker.settings.speed + 1e-3, `${topSpeed.toFixed(2)} m/s`);
checks.check('tempo de viagem condiz com aceleração e frenagem', straightSeconds > 6.4 && straightSeconds < 8, `${straightSeconds.toFixed(2)} s`);
checks.near('agente fica na altura do NavMesh', walker.position[1], 0, 1e-3);
checks.near('agente olha na direção do movimento', walker.heading, Math.PI / 4, 0.05);
const wallWorld = createWorld(bake((soup) => {
    openFloor(soup);
    addBox(soup, [1, 3, 12], [0, 1.5, 0]);
}));
const detourer = spawn(wallWorld, -5, 0);
let closestToWall = Infinity;
let leftMesh = false;
detourer.setDestination(vec3.create(5, 0, 0));
runUntil(wallWorld, () => detourer.hasArrived, () => {
    leftMesh ||= !detourer.isOnNavMesh;
    if (Math.abs(detourer.position[2]) < 6)
        closestToWall = Math.min(closestToWall, Math.abs(detourer.position[0]));
});
checks.check('agente contorna a parede e chega', detourer.hasArrived && detourer.position[0] > 4.8);
checks.check('agente nunca sai do NavMesh', !leftMesh);
checks.check('agente mantém o raio de distância da parede', closestToWall >= 0.5 + SETTINGS.agentRadius, `${closestToWall.toFixed(2)} m do eixo da parede`);
const crowdWorld = createWorld(bake(openFloor));
const eastbound = spawn(crowdWorld, -6, 0);
const westbound = spawn(crowdWorld, 6, 0);
let closestPass = Infinity;
eastbound.setDestination(vec3.create(6, 0, 0));
westbound.setDestination(vec3.create(-6, 0, 0));
runUntil(crowdWorld, () => eastbound.hasArrived && westbound.hasArrived, () => {
    closestPass = Math.min(closestPass, flatDistance(eastbound.position, westbound.position));
});
checks.check('agentes em rota de colisão chegam aos dois destinos', eastbound.hasArrived && westbound.hasArrived);
checks.check('agentes desviam um do outro sem se atravessar', closestPass >= (eastbound.settings.radius + westbound.settings.radius) * 0.9, `${closestPass.toFixed(2)} m`);
const priorityWorld = createWorld(bake(openFloor));
const important = spawn(priorityWorld, -6, 0, { avoidancePriority: 10 });
const yielding = spawn(priorityWorld, 6, 0, { avoidancePriority: 80 });
let importantDrift = 0;
important.setDestination(vec3.create(6, 0, 0));
yielding.setDestination(vec3.create(-6, 0, 0));
runUntil(priorityWorld, () => important.hasArrived && yielding.hasArrived, () => {
    importantDrift = Math.max(importantDrift, Math.abs(important.position[2]));
});
checks.check('agente de maior prioridade segue em linha reta', importantDrift < 0.2, `desvio de ${importantDrift.toFixed(2)} m`);
checks.check('agente de menor prioridade cede passagem e chega', yielding.hasArrived);
const carveMesh = bake(openFloor);
const carveWorld = createWorld(carveMesh);
const runner = spawn(carveWorld, -8, 0);
runner.setDestination(vec3.create(8, 0, 0));
runUntil(carveWorld, () => runner.position[0] > -6);
const versionBeforeCrate = carveMesh.version;
const crate = new NavObstacle(nextId++);
vec3.set(crate.position, 0, 1, 0);
crate.halfWidth = 1;
crate.halfHeight = 1;
crate.halfDepth = 1;
carveWorld.addObstacle(crate);
let closestToCrate = Infinity;
runUntil(carveWorld, () => runner.hasArrived, () => {
    closestToCrate = Math.min(closestToCrate, Math.max(Math.abs(runner.position[0]), Math.abs(runner.position[2])));
});
checks.check('obstáculo parado recorta o NavMesh', crate.isCarving && carveMesh.version > versionBeforeCrate);
checks.check('agente refaz o caminho e chega depois do recorte', runner.hasArrived && runner.position[0] > 7.8);
checks.check('agente não entra no recorte do obstáculo', closestToCrate >= 1 + SETTINGS.agentRadius - 0.25, `${closestToCrate.toFixed(2)} m do centro`);
const versionBeforeMove = carveMesh.version;
crate.position[0] = 5;
carveWorld.step(STEP);
checks.check('obstáculo em movimento solta o recorte', !crate.isCarving && carveMesh.version > versionBeforeMove);
runUntil(carveWorld, () => crate.isCarving);
checks.check('obstáculo volta a recortar depois de ficar parado', crate.isCarving && carveMesh.version > versionBeforeMove + 1);
const softWorld = createWorld(bake(openFloor));
const dodger = spawn(softWorld, -8, 0);
const pillar = new NavObstacle(nextId++);
vec3.set(pillar.position, 0, 1, 0);
pillar.shape = 'capsule';
pillar.carve = false;
softWorld.addObstacle(pillar);
let closestToPillar = Infinity;
dodger.setDestination(vec3.create(8, 0, 0));
runUntil(softWorld, () => dodger.hasArrived, () => {
    closestToPillar = Math.min(closestToPillar, flatDistance(dodger.position, pillar.position));
});
checks.check('agente desvia de obstáculo que não recorta', dodger.hasArrived && closestToPillar >= (dodger.settings.radius + pillar.boundingRadius) * 0.9, `${closestToPillar.toFixed(2)} m`);
const islandWorld = createWorld(bake((soup) => {
    addBox(soup, [9, 1, 10], [-5.5, -0.5, 0]);
    addBox(soup, [9, 1, 10], [5.5, -0.5, 0]);
}));
islandWorld.setLinks([{ id: 1, start: vec3.create(-2, 0, 0), end: vec3.create(2, 0, 0), bidirectional: true, costOverride: -1, area: JUMP_AREA }]);
const jumper = spawn(islandWorld, -7, 2);
let usedLink = false;
let jumpPeak = 0;
jumper.setDestination(vec3.create(7, 0, -2));
runUntil(islandWorld, () => jumper.hasArrived, () => {
    usedLink ||= jumper.isOnLink;
    jumpPeak = Math.max(jumpPeak, jumper.position[1]);
});
checks.check('agente atravessa o link fora da malha', usedLink && jumper.hasArrived && jumper.position[0] > 6.8);
checks.check('travessia do link faz um arco', jumpPeak > 0.3, `pico de ${jumpPeak.toFixed(2)} m`);
checks.check('agente volta ao NavMesh depois do link', jumper.isOnNavMesh);
const lost = spawn(islandWorld, 0, 0);
checks.check('teleporte para longe do NavMesh é recusado', !islandWorld.warp(lost, vec3.create(60, 0, 0)));
checks.check('teleporte para perto do NavMesh encaixa o agente', islandWorld.warp(lost, vec3.create(5, 0.4, 1)) && lost.isOnNavMesh && Math.abs(lost.position[1]) < 1e-3);
const sampled = vec3.create();
checks.check('amostra o ponto do NavMesh mais próximo', islandWorld.samplePosition(sampled, vec3.create(0, 0, 0), 2) && Math.abs(Math.abs(sampled[0]) - 1.5) < 0.3, `x ${sampled[0].toFixed(2)}`);
checks.finish();
