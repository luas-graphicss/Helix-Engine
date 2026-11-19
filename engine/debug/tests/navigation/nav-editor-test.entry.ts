import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import type { Command } from '@/engine/editor/history/command';
import { NavigationEditor } from '@/engine/editor/navigation/navigation-editor';
import { NavigationOverlay } from '@/engine/editor/navigation/navigation-overlay';
import { addNavAgent, canAddNavAgent, setNavAgentArea, setNavAgentScalar } from '@/engine/editor/operations/navigation/nav-agent-operations';
import { setNavAreaCost, setNavAreaName } from '@/engine/editor/operations/navigation/nav-area-operations';
import { addNavObstacle, removeNavObstacle } from '@/engine/editor/operations/navigation/nav-obstacle-operations';
import { setNavSurfaceScalar } from '@/engine/editor/operations/navigation/nav-surface-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { ALL_AREAS_MASK, areaBit, JUMP_AREA, WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { NO_CELL } from '@/engine/navigation/mesh/nav-cells';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { findCellAt } from '@/engine/navigation/mesh/nav-mesh-queries';
import { NavigationSystem } from '@/engine/navigation/scene/navigation-system';
import { createNavSurfaceSettings } from '@/engine/navigation/surface/nav-surface-settings';
import { createBox, createCapsule } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
type PlayState = 'stopped' | 'playing' | 'paused';
const STEP = 1 / 60;
const CAPSULE_RADIUS = 0.4;
const CAPSULE_BODY = 1;
const CAPSULE_HALF_HEIGHT = CAPSULE_RADIUS + CAPSULE_BODY / 2;
const SHAPE_TOLERANCE = 1e-3;
const CUSTOM_AREA = 4;
const MAX_AGENT_SPEED = 50;
const MAX_AREA_COST = 100;
class EditorStub {
    readonly scene = new Scene('Oficina');
    readonly log = { info: () => undefined, warn: () => undefined };
    readonly playtest: {
        state: PlayState;
        navigation: NavigationSystem | null;
    } = { state: 'stopped', navigation: null };
    readonly history = { execute: (command: Command) => this.run(command) };
    readonly navigation = new NavigationEditor(this.session);
    private readonly done: Command[] = [];
    get session(): EditorSession {
        return this as unknown as EditorSession;
    }
    notify(): void { }
    undo(): void {
        this.done.pop()?.undo();
    }
    private run(command: Command): void {
        command.execute();
        this.done.push(command);
    }
}
const checks = createCheckList('Navegação no editor');
const editor = new EditorStub();
const { scene, session, navigation } = editor;
const overlay = new NavigationOverlay();
function place(entity: Entity, x: number, y: number, z: number): Entity {
    vec3.set(entity.transform.position, x, y, z);
    return entity;
}
function isWalkableAt(mesh: NavMesh, x: number, z: number): boolean {
    return findCellAt(mesh, x, 0, z, 0.3) !== NO_CELL;
}
function bakedPreview(): NavMesh {
    navigation.bake(surface);
    const mesh = navigation.previewOf(surface)?.mesh;
    if (!mesh)
        throw new Error('The surface preview produced no walkable polygon.');
    return mesh;
}
function lineCount(selection: ReadonlySet<number> | null): number {
    return overlay.decorate(session, selection, null)?.debugLines.length ?? 0;
}
place(scene.createEntity({ name: 'ground', kind: 'mesh', mesh: createBox(20, 1, 20) }), 0, -0.5, 0);
const surface = scene.createEntity({ name: 'NavMesh', kind: 'group', navSurface: createNavSurfaceSettings() });
const barrier = place(scene.createEntity({ name: 'barrier', kind: 'group' }), 4, 0.5, 0);
const npc = place(scene.createEntity({ name: 'npc', kind: 'mesh', mesh: createCapsule(CAPSULE_RADIUS, CAPSULE_BODY) }), -4, CAPSULE_HALF_HEIGHT, 0);
checks.check('ator de malha pode virar agente', canAddNavAgent(npc));
addNavAgent(session, npc);
checks.near('agente nasce com o raio da malha', npc.navAgent?.radius ?? 0, CAPSULE_RADIUS, SHAPE_TOLERANCE);
checks.near('agente nasce com os pés na base da malha', npc.navAgent?.baseOffset ?? 0, CAPSULE_HALF_HEIGHT, SHAPE_TOLERANCE);
checks.check('quem já é agente não recebe outro', !canAddNavAgent(npc));
setNavAgentScalar(session, npc, 'speed', 999);
checks.check('velocidade do agente respeita o limite', npc.navAgent?.speed === MAX_AGENT_SPEED);
setNavAgentArea(session, npc, JUMP_AREA, false);
checks.check('desmarcar uma área tira o bit da máscara', npc.navAgent?.areaMask === (ALL_AREAS_MASK & ~areaBit(JUMP_AREA)));
editor.undo();
checks.check('desfazer devolve a máscara de áreas', npc.navAgent?.areaMask === ALL_AREAS_MASK);
addNavObstacle(session, barrier);
const carved = bakedPreview();
checks.check('gerar no editor produz a prévia do NavMesh', carved.polygons.count > 0 && isWalkableAt(carved, 0, 0));
checks.check('obstáculo da cena recorta a prévia', !isWalkableAt(carved, 4, 0));
removeNavObstacle(session, barrier);
checks.check('sem o obstáculo o piso volta inteiro', isWalkableAt(bakedPreview(), 4, 0));
checks.check('prévia recém-gerada está em dia', !navigation.isStale(surface));
setNavSurfaceScalar(session, surface, 'agentRadius', 0.6);
checks.check('mudar a superfície marca a prévia como desatualizada', navigation.isStale(surface));
editor.undo();
checks.check('desfazer a mudança devolve a prévia em dia', !navigation.isStale(surface));
const everything = lineCount(null);
checks.check('overlay desenha a malha e os componentes', everything > 0);
navigation.setHelpers('selected');
const agentOnly = lineCount(new Set([npc.id]));
checks.check('modo seleção não desenha nada sem seleção', lineCount(null) === 0);
checks.check('modo seleção desenha só o ator selecionado', agentOnly > 0 && agentOnly < everything, `${agentOnly} de ${everything} linhas`);
const surfaceOnly = lineCount(new Set([surface.id]));
checks.check('selecionar a superfície traz só a malha dela', surfaceOnly > 0 && surfaceOnly === everything - agentOnly, `${surfaceOnly} de ${everything} linhas`);
navigation.setHelpers('off');
checks.check('modo oculto não desenha nem a seleção', lineCount(new Set([npc.id])) === 0);
navigation.setHelpers('all');
const system = new NavigationSystem(scene);
system.build();
system.update(STEP);
editor.playtest.navigation = system;
editor.playtest.state = 'playing';
checks.check('ao simular o jogo fica limpo sem seleção', lineCount(null) === 0);
checks.check('ao simular a seleção mostra o agente e o NavMesh', lineCount(new Set([npc.id])) > agentOnly);
editor.playtest.state = 'paused';
checks.check('pausado o overlay volta a desenhar tudo', lineCount(null) > 0);
setNavAreaName(session, WALKABLE_AREA, 'Asfalto');
checks.check('área da engine não é renomeada', scene.navigation.areas[WALKABLE_AREA].name !== 'Asfalto');
setNavAreaName(session, CUSTOM_AREA, '  Lama  ');
setNavAreaCost(session, CUSTOM_AREA, 500);
checks.check('área livre aceita nome e custo dentro do limite', scene.navigation.areas[CUSTOM_AREA].name === 'Lama' && scene.navigation.areas[CUSTOM_AREA].cost === MAX_AREA_COST);
navigation.clear(surface);
checks.check('limpar remove a prévia', navigation.previewOf(surface) === null);
checks.finish();
