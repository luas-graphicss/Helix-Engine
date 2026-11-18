import { createRay } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { GizmoDrag, type SnapSource } from '@/engine/editor/transform/drag/gizmo-drag';
import { addVertexGrip, VERTEX_GRIP_ID } from '@/engine/editor/transform/gizmo/handles/vertex-grip';
import { SnapTargets } from '@/engine/editor/transform/snap/snap-targets';
import { createSurfaceHit, raycastSurfaces } from '@/engine/editor/transform/snap/surface-snap';
import { createVertexHit, nearestVertexToPointer, vertexWorldPosition } from '@/engine/editor/transform/snap/vertex-snap';
import { isSnapTarget, type SnapTarget } from '@/engine/editor/transform/transform-settings';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../../support/check-list';
import { beginDrag, buildStageGizmo, type ActiveDrag, type Stage } from './drag-stage';
import { createCamera, NO_SNAP, pointerOver, worldPositionOf, type PointerModifiers, type Triple } from './transform-fixture';
const TOLERANCE = 5e-3;
const checks = createCheckList('Alvos do encaixe: grade, vértice e superfície');
interface Yard extends Stage {
    readonly crate: Entity;
    readonly block: Entity;
}
function snappingTo(target: SnapTarget): SnapSource {
    return { ...NO_SNAP, enabled: true, target };
}
function addBox(scene: Scene, name: string, size: Triple, position: Triple): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh: createBox(...size) });
    vec3.set(entity.transform.position, ...position);
    return entity;
}
function createYard(cratePosition: Triple = [0, 2, 0]): Yard {
    const scene = new Scene();
    addBox(scene, 'Piso', [12, 1, 12], [0, -0.5, 0]);
    const block = addBox(scene, 'Bloco', [2, 2, 2], [4, 1, 0]);
    const crate = addBox(scene, 'Caixote', [1, 1, 1], cratePosition);
    scene.updateWorldMatrices();
    return { scene, camera: createCamera([0, 8, 14]), boxes: [crate], crate, block };
}
function grab(yard: Yard, handleId: string, from: Triple): ActiveDrag {
    return beginDrag(yard, 'translate', handleId, 'pivot', () => pointerOver(yard.camera, from));
}
function dragTo(yard: Yard, handleId: string, from: Triple, to: Triple, snap: SnapSource, modifiers: PointerModifiers = {}): Triple {
    const { drag } = grab(yard, handleId, from);
    drag.update(pointerOver(yard.camera, to, modifiers), snap);
    return worldPositionOf(yard.scene, yard.crate);
}
function grid(): void {
    const stepped = dragTo(createYard([0.3, 2, 0]), 'move.x', [1.3, 2, 0], [2.3, 2, 0], snappingTo('increment'));
    checks.nearAll('o incremento conta a partir de onde o ator estava', stepped, [1.3, 2, 0], TOLERANCE);
    const onGrid = dragTo(createYard([0.3, 2, 0]), 'move.x', [1.3, 2, 0], [2.3, 2, 0], snappingTo('grid'));
    checks.nearAll('a grade leva o pivô a uma posição do mundo múltipla do passo', onGrid, [1.5, 2, 0], TOLERANCE);
    const onPlane = dragTo(createYard([0.3, 2, 0.1]), 'move.xz', [0.3, 2, 0.1], [1.3, 2, 0.8], snappingTo('grid'));
    checks.nearAll('no plano a grade encaixa os dois eixos', onPlane, [1.5, 2, 1], TOLERANCE);
    const free = dragTo(createYard([0.3, 2, 0.1]), 'move.view', [0.3, 2, 0.1], [1.3, 2.2, 0.8], snappingTo('grid'));
    checks.check('no arrasto livre a grade encaixa os três eixos', free.every((component) => Math.abs(component * 2 - Math.round(component * 2)) < TOLERANCE), free.join(', '));
}
function vertices(): void {
    const corner: Triple = [3, 2, 1];
    const onAxis = dragTo(createYard(), 'move.x', [1, 2, 0], corner, snappingTo('vertex'));
    checks.nearAll('numa seta o pivô alinha com o vértice sob o cursor só naquele eixo', onAxis, [3, 2, 0], TOLERANCE);
    const onPlane = dragTo(createYard(), 'move.xz', [0, 2, 0], corner, snappingTo('vertex'));
    checks.nearAll('num plano o pivô alinha com o vértice sem sair do plano', onPlane, [3, 2, 1], TOLERANCE);
    const free = dragTo(createYard(), 'move.view', [0, 2, 0], [3, 0, 1], snappingTo('vertex'));
    checks.nearAll('no arrasto livre o pivô vai até o vértice', free, [3, 0, 1], TOLERANCE);
    const away: Triple = [-3, 2, 0];
    const loose = dragTo(createYard(), 'move.view', [0, 2, 0], away, snappingTo('vertex'));
    const unsnapped = dragTo(createYard(), 'move.view', [0, 2, 0], away, NO_SNAP);
    checks.nearAll('longe de qualquer vértice o movimento fica livre', loose, unsnapped, TOLERANCE);
    const inverted = dragTo(createYard(), 'move.view', [0, 2, 0], [3, 0, 1], { ...NO_SNAP, target: 'vertex' }, { ctrl: true });
    checks.nearAll('Ctrl liga o encaixe em vértice quando ele está desligado', inverted, [3, 0, 1], TOLERANCE);
}
function vertexGrip(): void {
    const yard = createYard();
    const { scene, camera, crate, block } = yard;
    const ray = createRay();
    const hit = createVertexHit();
    const nearCorner: Triple = [0.5, 2.5, 0.5];
    const over = pointerOver(camera, nearCorner);
    buildPickRay(ray, camera, over.x / over.width, over.y / over.height);
    checks.check('a busca acha o vértice da seleção sob o cursor', nearestVertexToPointer(hit, [crate], camera, over, ray) && hit.entity === crate);
    checks.nearAll('e devolve a posição dele no mundo', hit.point, nearCorner, TOLERANCE);
    const resolved = hit.entity ? vertexWorldPosition(vec3.create(), hit.entity, hit.index) : null;
    checks.nearAll('o índice devolvido aponta para o mesmo vértice', resolved ?? [], nearCorner, TOLERANCE);
    const beside = pointerOver(camera, [0.5, 2.5, 0.5]);
    const far = { ...beside, x: beside.x + 40 };
    buildPickRay(ray, camera, far.x / far.width, far.y / far.height);
    checks.check('a 40 px de distância nenhum vértice responde', !nearestVertexToPointer(hit, [crate, block], camera, far, ray));
    const { layout, frame } = buildStageGizmo(yard, 'translate', 'pivot');
    addVertexGrip(layout, frame, vec3.create(...nearCorner));
    const handle = layout.find(VERTEX_GRIP_ID);
    if (!handle)
        throw new Error('A alça de vértice deveria existir');
    const targets = { entities: [crate], active: crate };
    const drag = GizmoDrag.begin({ camera, frame, handle, targets, pivotMode: 'pivot', pointer: over, snapTargets: new SnapTargets(scene, [crate]) });
    if (!drag)
        throw new Error('O arrasto pelo vértice deveria começar');
    drag.update(pointerOver(camera, [3, 2, 1]), snappingTo('vertex'));
    checks.nearAll('arrastar um vértice da seleção leva esse vértice ao vértice alvo', worldPositionOf(scene, crate), [2.5, 1.5, 0.5], TOLERANCE);
}
function surfaces(): void {
    const onFloor = dragTo(createYard(), 'move.view', [0, 2, 0], [-2, 0, 3], snappingTo('surface'));
    checks.nearAll('sobre o piso a seleção fica apoiada nele', onFloor, [-2, 0.5, 3], TOLERANCE);
    const onTop = dragTo(createYard(), 'move.view', [0, 2, 0], [4, 2, 0.5], snappingTo('surface'));
    checks.nearAll('sobre o bloco ela sobe para o topo dele', onTop, [4, 2.5, 0.5], TOLERANCE);
    const onSide = dragTo(createYard(), 'move.view', [0, 2, 0], [3, 1, 0], snappingTo('surface'));
    checks.nearAll('na lateral ela encosta pela face', onSide, [2.5, 1, 0], TOLERANCE);
    const behind = dragTo(createYard(), 'move.view', [0, 2, 0], [0, 2, 0], snappingTo('surface'));
    checks.near('a própria seleção não conta como superfície', behind[1], 0.5, TOLERANCE);
    const onAxis = dragTo(createYard(), 'move.x', [1, 2, 0], [2, 2, 0], snappingTo('surface'));
    checks.nearAll('numa seta a superfície não interfere', onAxis, [1, 2, 0], TOLERANCE);
}
function surfaceNormals(): void {
    const scene = new Scene();
    const wall = addBox(scene, 'Parede', [1, 1, 1], [3, 0, 0]);
    vec3.set(wall.transform.rotation, 0, 0, 90);
    vec3.set(wall.transform.scale, 1, 3, 1);
    scene.updateWorldMatrices();
    const ray = createRay();
    vec3.set(ray.origin, -5, 0.2, 0.1);
    vec3.set(ray.direction, 1, 0, 0);
    const hit = createSurfaceHit();
    checks.check('o raio acerta a parede girada e esticada', raycastSurfaces(hit, [wall], ray));
    checks.nearAll('o ponto fica na face voltada para a origem do raio', hit.point, [1.5, 0.2, 0.1], TOLERANCE);
    checks.nearAll('a normal sai no espaço do mundo, contra o raio', hit.normal, [-1, 0, 0], TOLERANCE);
    vec3.set(ray.direction, -1, 0, 0);
    checks.check('um raio que se afasta não acerta nada', !raycastSurfaces(hit, [wall], ray));
}
function rectangle(): void {
    const scene = new Scene();
    const box = addBox(scene, 'Caixa', [1, 1, 1], [0.3, 0, 0]);
    scene.updateWorldMatrices();
    const stage: Stage = { scene, camera: createCamera([0, 0, 10]), boxes: [box] };
    const { drag } = beginDrag(stage, 'rect', 'rect.right', 'pivot', () => pointerOver(stage.camera, [0.8, 0, 0]));
    drag.update(pointerOver(stage.camera, [1.3, 0, 0]), snappingTo('grid'));
    checks.nearAll('no Retângulo a grade leva a borda de 0,8 a 1,5 no mundo', box.transform.scale, [1.7, 1, 1], TOLERANCE);
    checks.nearAll('com a borda oposta parada em -0,2', worldPositionOf(scene, box), [0.65, 0, 0], TOLERANCE);
}
function settings(): void {
    checks.check('os quatro alvos são reconhecidos', (['increment', 'grid', 'vertex', 'surface'] as const).every(isSnapTarget));
    checks.check('um alvo desconhecido é recusado', !isSnapTarget('edge') && !isSnapTarget(null));
}
grid();
vertices();
vertexGrip();
surfaces();
surfaceNormals();
rectangle();
settings();
checks.finish();
