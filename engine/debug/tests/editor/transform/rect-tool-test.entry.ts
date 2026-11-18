import * as vec3 from '@/engine/core/math/vec3';
import { Scene } from '@/engine/core/scene/scene';
import { SHORTCUT_ACTIONS } from '@/engine/editor/shortcuts/shortcut-actions';
import type { GizmoHandle } from '@/engine/editor/transform/gizmo/gizmo-handle';
import { toolHonorsSpace } from '@/engine/editor/transform/gizmo/gizmo-layout';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../../support/check-list';
import { beginDrag, buildStageGizmo, createStage, type ActiveDrag, type Stage } from './drag-stage';
import { createCamera, NO_SNAP, pointerOver, worldAxisOf, worldPositionOf, type PointerModifiers, type Triple } from './transform-fixture';
const TOLERANCE = 5e-3;
const SNAPPING = { ...NO_SNAP, enabled: true };
const RECT_HANDLES = ['rect.area', 'rect.left', 'rect.right', 'rect.bottom', 'rect.top', 'rect.bottomLeft', 'rect.bottomRight', 'rect.topRight', 'rect.topLeft', 'rect.rotate'];
const checks = createCheckList('Ferramenta Retângulo');
function handleOf(stage: Stage, id: string): GizmoHandle {
    const handle = buildStageGizmo(stage, 'rect', 'pivot').layout.find(id);
    if (!handle)
        throw new Error(`A alça ${id} deveria existir nesta vista`);
    return handle;
}
function grab(stage: Stage, id: string, from: Triple): ActiveDrag {
    return beginDrag(stage, 'rect', id, 'pivot', () => pointerOver(stage.camera, from));
}
function pull(stage: Stage, id: string, from: Triple, to: Triple, modifiers: PointerModifiers = {}): ActiveDrag {
    const active = grab(stage, id, from);
    active.drag.update(pointerOver(stage.camera, to, modifiers), NO_SNAP);
    return active;
}
function layout(): void {
    const stage = createStage([0, 0, 0]);
    const gizmo = buildStageGizmo(stage, 'rect', 'pivot').layout;
    checks.check('o retângulo traz a área, as quatro bordas, os quatro cantos e o giro', RECT_HANDLES.every((id) => gizmo.find(id) !== null));
    checks.nearAll('a borda direita fica no limite da malha', handleOf(stage, 'rect.right').points[0], [0.5, -0.5, 0], TOLERANCE);
    checks.nearAll('o canto superior direito fica no limite da malha', handleOf(stage, 'rect.topRight').points[0], [0.5, 0.5, 0], TOLERANCE);
    checks.check('o retângulo sempre acompanha os eixos do ator', !toolHonorsSpace('rect'));
    const owners = SHORTCUT_ACTIONS.filter((entry) => entry.scope === 'editor' && entry.defaults.includes('i'));
    checks.check('a tecla I só chama o Retângulo', owners.length === 1 && owners[0].id === 'tool.rect', owners.map((entry) => entry.id).join(', '));
}
function edges(): void {
    const stage = createStage([0, 0, 0]);
    const [box] = stage.boxes;
    const edge = pull(stage, 'rect.right', [0.5, 0, 0], [1.5, 0, 0]);
    checks.nearAll('puxar a borda direita dobra a largura', box.transform.scale, [2, 1, 1], TOLERANCE);
    checks.nearAll('a borda oposta fica onde estava', worldPositionOf(stage.scene, box), [0.5, 0, 0], TOLERANCE);
    checks.check('a leitura mostra o novo tamanho', edge.drag.readout === 'X 2,00 m', edge.drag.readout);
    edge.drag.update(pointerOver(stage.camera, [1.3, 0, 0]), SNAPPING);
    checks.nearAll('com o encaixe a borda anda de incremento em incremento', box.transform.scale, [2, 1, 1], TOLERANCE);
    edge.drag.update(pointerOver(stage.camera, [-2, 0, 0]), NO_SNAP);
    checks.check('a borda nunca atravessa a oposta', box.transform.scale[0] > 0, String(box.transform.scale[0]));
    edge.drag.restore();
    pull(stage, 'rect.bottom', [0, -0.5, 0], [0, -1, 0]);
    checks.nearAll('puxar a borda de baixo cresce para baixo', box.transform.scale, [1, 1.5, 1], TOLERANCE);
    checks.nearAll('e o topo não sai do lugar', worldPositionOf(stage.scene, box), [0, -0.25, 0], TOLERANCE);
}
function corners(): void {
    const stage = createStage([0, 0, 0]);
    const [box] = stage.boxes;
    const corner = pull(stage, 'rect.topRight', [0.5, 0.5, 0], [1.5, 1, 0]);
    checks.nearAll('o canto redimensiona os dois eixos de uma vez', box.transform.scale, [2, 1.5, 1], TOLERANCE);
    checks.nearAll('o canto oposto fica onde estava', worldPositionOf(stage.scene, box), [0.5, 0.25, 0], TOLERANCE);
    checks.check('a leitura do canto mostra os dois tamanhos', corner.drag.readout === 'X 2,00 m · Y 1,50 m', corner.drag.readout);
    corner.drag.update(pointerOver(stage.camera, [1.5, 1, 0], { shift: true }), NO_SNAP);
    checks.nearAll('com Shift o canto mantém a proporção', box.transform.scale, [2, 2, 1], TOLERANCE);
}
function moveAndRotate(): void {
    const stage = createStage([0, 0, 0]);
    const [box] = stage.boxes;
    const move = pull(stage, 'rect.area', [0.1, 0.1, 0], [1.1, 0.6, 0]);
    checks.nearAll('arrastar por dentro move no plano do retângulo', worldPositionOf(stage.scene, box), [1, 0.5, 0], TOLERANCE);
    move.drag.restore();
    const knob = handleOf(stage, 'rect.rotate').points[0];
    const turn = grab(stage, 'rect.rotate', [knob[0], knob[1], knob[2]]);
    turn.drag.update(pointerOver(stage.camera, [-knob[1], 0, 0]), NO_SNAP);
    checks.nearAll('o botão de giro roda em torno da normal do retângulo', worldAxisOf(stage.scene, box, 0), [0, 1, 0], TOLERANCE);
}
function rotatedActor(): void {
    const scene = new Scene();
    const plank = scene.createEntity({ name: 'Tábua', kind: 'mesh', mesh: createBox(2, 1, 1) });
    vec3.set(plank.transform.rotation, 0, 90, 0);
    scene.updateWorldMatrices();
    const stage: Stage = { scene, camera: createCamera([0, 0, 10]), boxes: [plank] };
    pull(stage, 'rect.top', [0.5, 0, 0], [1.5, 0, 0]);
    checks.nearAll('num ator girado a borda escala o eixo local correspondente', plank.transform.scale, [1, 1, 2], TOLERANCE);
    checks.nearAll('e o ator cresce só para o lado puxado', worldPositionOf(scene, plank), [0.5, 0, 0], TOLERANCE);
}
function manyActors(): void {
    const stage = createStage([-2, 0, 0], [2, 0, 0]);
    pull(stage, 'rect.right', [2.5, 0, 0], [5, 0, 0]);
    checks.nearAll('com vários atores o retângulo envolve todos', stage.boxes[0].transform.scale, [1.5, 1, 1], TOLERANCE);
    checks.nearAll('o primeiro ator se afasta da borda fixa na mesma proporção', worldPositionOf(stage.scene, stage.boxes[0]), [-1.75, 0, 0], TOLERANCE);
    checks.nearAll('o segundo ator também', worldPositionOf(stage.scene, stage.boxes[1]), [4.25, 0, 0], TOLERANCE);
}
function withoutBounds(): void {
    const scene = new Scene();
    const marker = scene.createEntity({ name: 'Marcador', kind: 'group' });
    scene.updateWorldMatrices();
    const gizmo = buildStageGizmo({ scene, camera: createCamera([6, 5, 8]), boxes: [marker] }, 'rect', 'pivot').layout;
    checks.check('sem malha o retângulo vira o gizmo de mover', gizmo.find('rect.area') === null && gizmo.find('move.x') !== null);
}
layout();
edges();
corners();
moveAndRotate();
rotatedActor();
manyActors();
withoutBounds();
checks.finish();
