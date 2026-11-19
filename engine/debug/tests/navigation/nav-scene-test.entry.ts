import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { cloneEntity } from '@/engine/core/scene/entity-utils';
import { Scene } from '@/engine/core/scene/scene';
import { MaterialLibrary } from '@/engine/materials/material-library';
import { createNavAgentSettings } from '@/engine/navigation/agent/nav-agent-settings';
import { createNavLinkSettings } from '@/engine/navigation/link/nav-link-settings';
import { NO_CELL } from '@/engine/navigation/mesh/nav-cells';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { findCellAt } from '@/engine/navigation/mesh/nav-mesh-queries';
import { createNavModifierSettings } from '@/engine/navigation/modifier/nav-modifier-settings';
import { createNavObstacleSettings } from '@/engine/navigation/obstacle/nav-obstacle-settings';
import { bakeSurface } from '@/engine/navigation/scene/bake-surface';
import { NavigationSystem } from '@/engine/navigation/scene/navigation-system';
import { createNavSurfaceSettings } from '@/engine/navigation/surface/nav-surface-settings';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { deserializeScene } from '@/engine/project/scene-document/deserialize-scene';
import { serializeScene } from '@/engine/project/scene-document/serialize-scene';
import { createBox, createCapsule } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const STEP = 1 / 60;
const TIMEOUT_SECONDS = 40;
const BASE_OFFSET = 0.9;
const RUG_AREA = 4;
const SWAMP_AREA = 5;
const checks = createCheckList('Navegação na cena');
const scene = new Scene('Praça');
function place(entity: Entity, x: number, y: number, z: number): Entity {
    vec3.set(entity.transform.position, x, y, z);
    return entity;
}
function isWalkableAt(mesh: NavMesh, x: number, z: number): boolean {
    return findCellAt(mesh, x, 0, z, 0.3) !== NO_CELL;
}
function areaAt(mesh: NavMesh, x: number, z: number): number {
    const cell = findCellAt(mesh, x, 0, z, 0.3);
    return cell === NO_CELL ? -1 : mesh.polygons.areas[mesh.polygonOf(cell)];
}
function bakedMesh(surface: Entity | null, overrides = {}): NavMesh {
    scene.updateWorldMatrices();
    const { mesh } = bakeSurface(scene, surface, createNavSurfaceSettings(overrides));
    if (!mesh)
        throw new Error('The surface produced no walkable polygon.');
    return mesh;
}
place(scene.createEntity({ name: 'ground', kind: 'mesh', mesh: createBox(24, 1, 24) }), 0, -0.5, 0);
place(scene.createEntity({ name: 'platform', kind: 'mesh', mesh: createBox(6, 1, 6) }), 20, -0.5, 0);
const wall = place(scene.createEntity({ name: 'wall', kind: 'mesh', mesh: createBox(1, 3, 12) }), 0, 1.5, 0);
place(scene.createEntity({ name: 'crate', kind: 'mesh', mesh: createBox(2, 2, 2), rigidBody: createRigidBodySettings({ type: 'dynamic', collider: 'box', boxSize: vec3.create(2, 2, 2) }) }), -6, 1, 6);
place(scene.createEntity({ name: 'rug', kind: 'mesh', mesh: createBox(4, 0.05, 4), navModifier: createNavModifierSettings({ mode: 'area', area: RUG_AREA }) }), -6, 0.025, -6);
place(scene.createEntity({ name: 'swamp', kind: 'group', navModifier: createNavModifierSettings({ mode: 'volume', area: SWAMP_AREA, size: vec3.create(4, 2, 4) }) }), 6, 0, -6);
const surface = scene.createEntity({ name: 'NavMesh', kind: 'group', navSurface: createNavSurfaceSettings() });
const target = place(scene.createEntity({ name: 'target', kind: 'group' }), 6, 0, 0);
const npc = place(scene.createEntity({ name: 'npc', kind: 'mesh', mesh: createCapsule(0.4, 1), navAgent: createNavAgentSettings({ baseOffset: BASE_OFFSET, target: target.id }) }), -6, BASE_OFFSET, 0);
const bridge = place(scene.createEntity({ name: 'bridge', kind: 'group', navLink: createNavLinkSettings({ start: vec3.create(-3.5, 0, 0), end: vec3.create(3.5, 0, 0) }) }), 14.5, 0, 0);
checks.check('cena com superfície ou agente liga a navegação', NavigationSystem.isUsedBy(scene) && !NavigationSystem.isUsedBy(new Scene('Vazia')));
const system = new NavigationSystem(scene);
system.build();
const [report] = system.reports;
const mesh = report.mesh;
if (!mesh)
    throw new Error('The scene surface produced no walkable polygon.');
checks.check('a superfície da cena gera um NavMesh com o nome do ator', system.reports.length === 1 && report.surfaceName === 'NavMesh');
checks.check('parede estática entra na geração', !isWalkableAt(mesh, 0, 0));
checks.check('corpo dinâmico fica fora da geração', isWalkableAt(mesh, -6, 6));
checks.check('o próprio agente fica fora da geração', isWalkableAt(mesh, -6, 0));
checks.check('modificador de área marca a geometria do ator', areaAt(mesh, -6, -6) === RUG_AREA, `área ${areaAt(mesh, -6, -6)}`);
checks.check('volume de área pinta o piso dentro dele', areaAt(mesh, 6, -6) === SWAMP_AREA && areaAt(mesh, 6, 6) === 0);
let arrivedEntity: Entity | null = null;
system.onArrived = (entity) => {
    arrivedEntity = entity;
};
function runUntil(isDone: () => boolean, observe: () => void = () => undefined): void {
    for (let elapsed = 0; elapsed < TIMEOUT_SECONDS && !isDone(); elapsed += STEP) {
        system.update(STEP);
        observe();
    }
}
function isNear(entity: Entity, x: number, z: number): boolean {
    return Math.hypot(entity.transform.position[0] - x, entity.transform.position[2] - z) < 0.3;
}
runUntil(() => arrivedEntity !== null);
checks.check('agente com alvo anda até o ator de destino', isNear(npc, 6, 0), `em ${Array.from(npc.transform.position).map((value) => value.toFixed(2)).join(', ')}`);
checks.check('chegada avisa qual ator chegou', arrivedEntity === npc);
checks.near('ator do agente fica na altura do NavMesh mais o deslocamento da base', npc.transform.position[1], BASE_OFFSET, 1e-3);
vec3.set(target.transform.position, 6, 0, 8);
runUntil(() => isNear(npc, 6, 8));
checks.check('agente segue o alvo quando ele muda de lugar', isNear(npc, 6, 8));
const barrier = place(scene.createEntity({ name: 'barrier', kind: 'mesh', mesh: createBox(2, 2, 2), navObstacle: createNavObstacleSettings({ size: vec3.create(2, 2, 2) }) }), -6, 1, -1);
system.update(STEP);
checks.check('obstáculo da cena recorta o NavMesh', !isWalkableAt(mesh, -6, -1) && isWalkableAt(mesh, -6, 3));
barrier.navObstacle = null;
system.update(STEP);
checks.check('remover o componente devolve o piso recortado', isWalkableAt(mesh, -6, -1));
vec3.set(target.transform.position, 20, 0, 0);
let crossedBridge = false;
runUntil(() => isNear(npc, 20, 0), () => {
    crossedBridge ||= system.agentOf(npc)?.isOnLink === true;
});
checks.check('agente atravessa o link da cena até a plataforma', crossedBridge && isNear(npc, 20, 0));
if (bridge.navLink)
    bridge.navLink.enabled = false;
vec3.set(target.transform.position, -6, 0, 0);
runUntil(() => system.agentOf(npc)?.hasArrived === true);
checks.check('link desativado deixa o agente preso na plataforma', npc.transform.position[0] > 17);
wall.navModifier = createNavModifierSettings({ mode: 'ignore' });
checks.check('modificador de ignorar tira o ator da geração', isWalkableAt(bakedMesh(surface), 0, 0));
wall.navModifier = null;
const boxed = bakedMesh(surface, { collect: 'volume', volumeSize: vec3.create(8, 4, 8), volumeCenter: vec3.create(6, 0, 0) });
checks.check('modo volume gera só dentro da caixa da superfície', isWalkableAt(boxed, 6, 0) && !isWalkableAt(boxed, -8, 0) && boxed.walkableArea <= 64);
const island = place(scene.createEntity({ name: 'island', kind: 'mesh', mesh: createBox(8, 1, 8) }, surface), -30, -0.5, 0);
const children = bakedMesh(surface, { collect: 'children' });
checks.check('modo filhos gera só a geometria dentro da superfície', isWalkableAt(children, -30, 0) && !isWalkableAt(children, 6, 0));
surface.remove(island);
scene.navigation.areas[SWAMP_AREA].name = 'Pântano';
scene.navigation.areas[SWAMP_AREA].cost = 6;
const document = await serializeScene(scene, { libraryDocumentForTerrainMaterial: () => null });
const { scene: reopened, warnings } = await deserializeScene(document, { materials: new MaterialLibrary(() => undefined, null) });
checks.check('abrir a cena salva não gera avisos', warnings.length === 0, warnings.join(' | '));
function reopenedActor(name: string): Entity {
    const found = reopened.entities.find((entity) => entity.name === name);
    if (!found)
        throw new Error(`The reopened scene lost the actor ${name}.`);
    return found;
}
const reopenedNpc = reopenedActor('npc');
const reopenedBridge = reopenedActor('bridge');
checks.check('agente volta do arquivo com alvo e deslocamento', reopenedNpc.navAgent?.target === target.id && reopenedNpc.navAgent.baseOffset === BASE_OFFSET);
checks.check('superfície volta do arquivo', reopenedActor('NavMesh').navSurface?.cellSize === 0.25 && reopenedActor('NavMesh').navSurface?.collect === 'scene');
checks.check('link volta do arquivo desativado e com as pontas', reopenedBridge.navLink?.enabled === false && reopenedBridge.navLink.start[0] === -3.5 && reopenedBridge.navLink.end[0] === 3.5);
checks.check('modificadores voltam do arquivo', reopenedActor('rug').navModifier?.area === RUG_AREA && reopenedActor('swamp').navModifier?.mode === 'volume' && reopenedActor('swamp').navModifier?.size[0] === 4);
checks.check('tabela de áreas da cena volta do arquivo', reopened.navigation.areas[SWAMP_AREA].name === 'Pântano' && reopened.navigation.areas[SWAMP_AREA].cost === 6);
barrier.navObstacle = createNavObstacleSettings({ shape: 'capsule' });
const barrierCopy = cloneEntity(scene, barrier, null);
checks.check('duplicar copia o obstáculo sem compartilhar vetores', barrierCopy.navObstacle?.shape === 'capsule' && barrierCopy.navObstacle.size !== barrier.navObstacle.size);
checks.finish();
