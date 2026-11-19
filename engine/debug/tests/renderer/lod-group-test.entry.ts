import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { cloneEntity } from '@/engine/core/scene/entity-utils';
import { Scene } from '@/engine/core/scene/scene';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { VisibleSet, type CullingOptions } from '@/engine/renderer/culling/visible-set';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { selectLodGroupLevel } from '@/engine/renderer/lod/groups/lod-group-selector';
import { createLodGroupSettings, normalizeLodGroupSettings, resizeLodGroupLevels } from '@/engine/renderer/lod/groups/lod-group-settings';
import { setLodGroupPreview } from '@/engine/renderer/render-overrides';
import { createCheckList } from '../support/check-list';
const VIEWPORT_HEIGHT = 720;
const SCREEN_HEIGHTS = [0.5, 0.2, 0.05];
const CULLED = SCREEN_HEIGHTS.length;
const GROUPS_ON: CullingOptions = { frustumCulling: true, minPixelSize: 0, occlusionCulling: false, lodGroups: true };
const GROUPS_OFF: CullingOptions = { ...GROUPS_ON, lodGroups: false };
const checks = createCheckList('Grupos de LOD');
function createGroupScene(): { scene: Scene; group: Entity } {
    const scene = new Scene();
    const group = scene.createEntity({ name: 'tree', kind: 'group', lodGroup: { screenHeights: [...SCREEN_HEIGHTS], radius: 1 } });
    scene.createEntity({ name: 'high', kind: 'mesh', mesh: createBox() }, group);
    scene.createEntity({ name: 'mid', kind: 'mesh', mesh: createBox() }, group);
    const low = scene.createEntity({ name: 'low', kind: 'group' }, group);
    scene.createEntity({ name: 'low mesh', kind: 'mesh', mesh: createBox() }, low);
    scene.createEntity({ name: 'collider', kind: 'mesh', mesh: createBox() }, group);
    return { scene, group };
}
function drawnAt(scene: Scene, distance: number, options: CullingOptions = GROUPS_ON): string {
    const camera = new PerspectiveCamera();
    vec3.set(camera.position, 0, 0, distance);
    camera.aspect = 16 / 9;
    camera.updateMatrices();
    scene.updateWorldMatrices();
    const visible = new VisibleSet();
    visible.collect(scene, camera, VIEWPORT_HEIGHT, options);
    const casters = visible.casters.map((caster) => caster.entity.name).sort().join(',');
    const meshes = visible.meshes.map((item) => item.entity.name).sort().join(',');
    return meshes === casters ? meshes : `${meshes} | sombras: ${casters}`;
}
function selector(): void {
    checks.check('acima da primeira transição fica o nível 0', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.8, undefined) === 0);
    checks.check('entre a primeira e a segunda transição fica o nível 1', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.3, undefined) === 1);
    checks.check('entre a segunda e a última transição fica o nível 2', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.1, undefined) === 2);
    checks.check('abaixo da última transição o grupo some', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.01, undefined) === CULLED);
    checks.check('a câmera dentro do grupo mostra o nível 0', selectLodGroupLevel(SCREEN_HEIGHTS, 3, Infinity, 2) === 0);
    checks.check('logo abaixo da transição o nível anterior é mantido', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.47, 0) === 0);
    checks.check('bem abaixo da transição o nível cai', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.44, 0) === 1);
    checks.check('logo acima da transição o nível anterior é mantido', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.52, 1) === 1);
    checks.check('bem acima da transição o nível sobe', selectLodGroupLevel(SCREEN_HEIGHTS, 3, 0.56, 1) === 0);
    checks.check('só os níveis com filho contam', selectLodGroupLevel(SCREEN_HEIGHTS, 2, 0.1, undefined) === 2);
}
function visibility(): void {
    const { scene, group } = createGroupScene();
    checks.check('de perto, só o filho mais detalhado é desenhado', drawnAt(scene, 2) === 'collider,high', drawnAt(scene, 2));
    checks.check('a meia distância, só o filho intermediário é desenhado', drawnAt(scene, 5) === 'collider,mid', drawnAt(scene, 5));
    checks.check('de longe, só a subárvore do último filho é desenhada', drawnAt(scene, 15) === 'collider,low mesh', drawnAt(scene, 15));
    checks.check('além da última transição, nenhum nível é desenhado', drawnAt(scene, 60) === 'collider', drawnAt(scene, 60));
    checks.check('com os grupos desligados, vale sempre o mais detalhado', drawnAt(scene, 60, GROUPS_OFF) === 'collider,high', drawnAt(scene, 60, GROUPS_OFF));
    setLodGroupPreview(group, 1);
    checks.check('a pré-visualização fixa o nível escolhido', drawnAt(scene, 2) === 'collider,mid', drawnAt(scene, 2));
    setLodGroupPreview(group, null);
    checks.check('sem pré-visualização, a distância volta a decidir', drawnAt(scene, 2) === 'collider,high', drawnAt(scene, 2));
    vec3.set(group.transform.scale, 4, 4, 4);
    checks.check('a escala do grupo aumenta a altura em tela', drawnAt(scene, 15) === 'collider,mid', drawnAt(scene, 15));
}
function statistics(): void {
    const { scene } = createGroupScene();
    const camera = new PerspectiveCamera();
    vec3.set(camera.position, 0, 0, 60);
    camera.updateMatrices();
    scene.updateWorldMatrices();
    const visible = new VisibleSet();
    visible.collect(scene, camera, VIEWPORT_HEIGHT, GROUPS_ON);
    checks.check('as estatísticas contam o grupo e o seu descarte', visible.stats.lodGroups === 1 && visible.stats.lodGroupsCulled === 1);
}
function settings(): void {
    checks.nearAll('três níveis nascem com transições decrescentes', createLodGroupSettings(3).screenHeights, [0.5, 0.2, 0.02]);
    checks.nearAll('um nível só some bem pequeno em tela', createLodGroupSettings(1).screenHeights, [0.02]);
    checks.nearAll('aumentar os níveis preserva as transições existentes', resizeLodGroupLevels({ screenHeights: [0.6, 0.3], radius: 2 }, 3).screenHeights, [0.6, 0.3, 0.12]);
    const repaired = normalizeLodGroupSettings({ screenHeights: [0.2, 0.9, Number.NaN, -4], radius: -3 });
    const descending = repaired.screenHeights.every((height, level) => level === 0 || height < repaired.screenHeights[level - 1]);
    checks.check('transições inválidas voltam a ser decrescentes e positivas', descending && repaired.screenHeights.every((height) => height > 0), repaired.screenHeights.join(', '));
    checks.check('um raio inválido volta a ser positivo', repaired.radius > 0);
}
function cloning(): void {
    const { scene, group } = createGroupScene();
    const copy = cloneEntity(scene, group, scene.root);
    checks.check('a cópia de um grupo leva as suas transições', copy.lodGroup !== null && copy.lodGroup !== group.lodGroup && copy.lodGroup.screenHeights.join() === SCREEN_HEIGHTS.join());
}
selector();
visibility();
statistics();
settings();
cloning();
checks.finish();
