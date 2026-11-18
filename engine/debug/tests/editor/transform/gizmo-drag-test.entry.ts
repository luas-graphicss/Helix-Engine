import { degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import { Scene } from '@/engine/core/scene/scene';
import { createGizmoFrame } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../../support/check-list';
import { alongAxis, beginDrag, createStage, onRing, type Stage } from './drag-stage';
import { createCamera, NO_SNAP, pointerAt, pointerOver, VIEWPORT_SIZE, worldAxisOf, worldPositionOf, type Triple } from './transform-fixture';
const TOLERANCE = 5e-3;
const SNAPPING = { ...NO_SNAP, enabled: true };
const SCREEN_CENTER = VIEWPORT_SIZE / 2;
const checks = createCheckList('Arrasto das alças do gizmo');
function shifted(point: Triple, x: number): Triple {
    return [point[0] + x, point[1], point[2]];
}
function translation(): void {
    const stage = createStage([0, 0, 0]);
    const { scene, camera, boxes } = stage;
    const [box] = boxes;
    let grab: Triple = [0, 0, 0];
    const { drag } = beginDrag(stage, 'translate', 'move.x', 'pivot', (frame) => {
        grab = alongAxis(frame, 0, 0.6);
        return pointerOver(camera, grab);
    });
    const release = shifted(grab, 1.44);
    drag.update(pointerOver(camera, grab), NO_SNAP);
    checks.check('sem mover o ponteiro nada conta como alterado', drag.changes().length === 0);
    drag.update(pointerOver(camera, release), NO_SNAP);
    checks.nearAll('a seta leva o ator pela distância percorrida no eixo', worldPositionOf(scene, box), [1.44, 0, 0], TOLERANCE);
    drag.update(pointerOver(camera, release), SNAPPING);
    checks.nearAll('com o encaixe ligado o deslocamento cai no incremento', worldPositionOf(scene, box), [1.5, 0, 0], TOLERANCE);
    checks.check('a leitura mostra o eixo e a distância', drag.readout === 'X 1,50 m', drag.readout);
    drag.update(pointerOver(camera, release, { ctrl: true }), SNAPPING);
    checks.nearAll('Ctrl desliga o encaixe durante o arrasto', worldPositionOf(scene, box), [1.44, 0, 0], TOLERANCE);
    drag.update(pointerOver(camera, release, { ctrl: true }), NO_SNAP);
    checks.nearAll('Ctrl liga o encaixe quando ele está desligado', worldPositionOf(scene, box), [1.5, 0, 0], TOLERANCE);
    const changes = drag.changes();
    checks.check('o arrasto registra uma alteração por ator movido', changes.length === 1 && changes[0].entity === box);
    checks.nearAll('a alteração guarda a posição de antes', changes[0].before.position, [0, 0, 0], 0);
    checks.nearAll('a alteração guarda a posição de depois', changes[0].after.position, [1.5, 0, 0], TOLERANCE);
    drag.restore();
    checks.nearAll('cancelar devolve o ator ao início', box.transform.position, [0, 0, 0], 0);
}
function groupTranslation(): void {
    const scene = new Scene();
    const mount = scene.createEntity({ name: 'Suporte', kind: 'group' });
    vec3.set(mount.transform.position, 0, 2, 0);
    vec3.set(mount.transform.rotation, 0, 90, 0);
    const lamp = scene.createEntity({ name: 'Luminária', kind: 'mesh', mesh: createBox(1, 1, 1) }, mount);
    const crate = scene.createEntity({ name: 'Caixote', kind: 'mesh', mesh: createBox(1, 1, 1) });
    vec3.set(crate.transform.position, 0, -2, 0);
    scene.updateWorldMatrices();
    const stage: Stage = { scene, camera: createCamera([0, 0, 10]), boxes: [lamp, crate] };
    let grab: Triple = [0, 0, 0];
    const { drag } = beginDrag(stage, 'translate', 'move.x', 'pivot', (frame) => {
        grab = alongAxis(frame, 0, 0.6);
        return pointerOver(stage.camera, grab);
    });
    drag.update(pointerOver(stage.camera, shifted(grab, 1)), NO_SNAP);
    checks.nearAll('o ator ativo anda no mundo', worldPositionOf(scene, crate), [1, -2, 0], TOLERANCE);
    checks.nearAll('os demais andam a mesma distância no mundo', worldPositionOf(scene, lamp), [1, 2, 0], TOLERANCE);
    checks.nearAll('dentro de um pai girado a posição local muda no eixo do pai', lamp.transform.position, [0, 0, 1], TOLERANCE);
    checks.check('cada ator movido vira uma alteração', drag.changes().length === 2);
}
function rotation(): void {
    const stage = createStage([0, 0, 0]);
    const { scene, camera, boxes } = stage;
    const [box] = boxes;
    let ring = createGizmoFrame();
    const { drag } = beginDrag(stage, 'rotate', 'rotate.z', 'pivot', (frame) => {
        ring = frame;
        return pointerOver(camera, onRing(frame, 0));
    });
    drag.update(pointerOver(camera, onRing(ring, 90)), NO_SNAP);
    checks.nearAll('um quarto de volta no anel gira o ator 90°', worldAxisOf(scene, box, 0), [0, 1, 0], TOLERANCE);
    checks.nearAll('girar no próprio pivô não desloca o ator', worldPositionOf(scene, box), [0, 0, 0], TOLERANCE);
    drag.update(pointerOver(camera, onRing(ring, 180)), NO_SNAP);
    drag.update(pointerOver(camera, onRing(ring, 270)), NO_SNAP);
    checks.nearAll('a rotação continua somando depois de meia volta', worldAxisOf(scene, box, 0), [0, -1, 0], TOLERANCE);
    checks.check('a leitura acompanha a volta acumulada', drag.readout === '270,0°', drag.readout);
    drag.restore();
    const snapped = beginDrag(stage, 'rotate', 'rotate.z', 'pivot', (frame) => pointerOver(camera, onRing(frame, 0)));
    snapped.drag.update(pointerOver(camera, onRing(snapped.frame, 100)), SNAPPING);
    checks.nearAll('com o encaixe o ângulo cai em múltiplos do incremento', worldAxisOf(scene, box, 0), [Math.cos(degToRad(105)), Math.sin(degToRad(105)), 0], TOLERANCE);
}
function pivotModes(): void {
    const around = createStage([-2, 0, 0], [2, 0, 0]);
    const center = beginDrag(around, 'rotate', 'rotate.z', 'center', (frame) => pointerOver(around.camera, onRing(frame, 0)));
    checks.nearAll('em Centro o gizmo fica no meio da seleção', center.frame.origin, [0, 0, 0], TOLERANCE);
    center.drag.update(pointerOver(around.camera, onRing(center.frame, 90)), NO_SNAP);
    checks.nearAll('em Centro o primeiro ator orbita o meio', worldPositionOf(around.scene, around.boxes[0]), [0, -2, 0], TOLERANCE);
    checks.nearAll('em Centro o segundo ator orbita o meio', worldPositionOf(around.scene, around.boxes[1]), [0, 2, 0], TOLERANCE);
    checks.nearAll('em Centro os atores também giram', worldAxisOf(around.scene, around.boxes[0], 0), [0, 1, 0], TOLERANCE);
    const own = createStage([-2, 0, 0], [2, 0, 0]);
    const pivot = beginDrag(own, 'rotate', 'rotate.z', 'pivot', (frame) => pointerOver(own.camera, onRing(frame, 0)));
    checks.nearAll('em Pivô o gizmo fica no ator ativo', pivot.frame.origin, [2, 0, 0], TOLERANCE);
    pivot.drag.update(pointerOver(own.camera, onRing(pivot.frame, 90)), NO_SNAP);
    checks.nearAll('em Pivô cada ator fica onde estava', worldPositionOf(own.scene, own.boxes[0]), [-2, 0, 0], TOLERANCE);
    checks.nearAll('em Pivô cada ator gira em torno de si', worldAxisOf(own.scene, own.boxes[0], 0), [0, 1, 0], TOLERANCE);
}
function scaling(): void {
    const stage = createStage([0, 0, 0]);
    const { camera, boxes } = stage;
    const [box] = boxes;
    let grip = createGizmoFrame();
    const axis = beginDrag(stage, 'scale', 'scale.x', 'pivot', (frame) => {
        grip = frame;
        return pointerOver(camera, alongAxis(frame, 0, 0.6));
    });
    axis.drag.update(pointerOver(camera, alongAxis(grip, 0, 1.2)), NO_SNAP);
    checks.nearAll('puxar a haste ao dobro da distância dobra a escala no eixo', box.transform.scale, [2, 1, 1], TOLERANCE);
    checks.check('a leitura mostra o eixo e o fator', axis.drag.readout === 'X × 2,00', axis.drag.readout);
    axis.drag.update(pointerOver(camera, alongAxis(grip, 0, 0.6 * 1.57)), SNAPPING);
    checks.nearAll('com o encaixe o fator cai no incremento', box.transform.scale, [1.6, 1, 1], TOLERANCE);
    axis.drag.restore();
    const uniform = beginDrag(stage, 'scale', 'scale.uniform', 'pivot', () => pointerAt(SCREEN_CENTER, SCREEN_CENTER));
    uniform.drag.update(pointerAt(SCREEN_CENTER + 200, SCREEN_CENTER), NO_SNAP);
    checks.nearAll('o cubo central escala os três eixos juntos', box.transform.scale, [2, 2, 2], TOLERANCE);
    uniform.drag.update(pointerAt(0, SCREEN_CENTER), NO_SNAP);
    checks.check('a escala nunca zera nem inverte', box.transform.scale.every((component) => component > 0), Array.from(box.transform.scale).join(', '));
}
function groupScaling(): void {
    const stage = createStage([-2, 0, 0], [2, 0, 0]);
    const { scene, camera, boxes } = stage;
    let grip = createGizmoFrame();
    const { drag } = beginDrag(stage, 'scale', 'scale.x', 'center', (frame) => {
        grip = frame;
        return pointerOver(camera, alongAxis(frame, 0, 0.6));
    });
    drag.update(pointerOver(camera, alongAxis(grip, 0, 1.2)), NO_SNAP);
    checks.nearAll('em Centro a escala afasta o primeiro ator do meio', worldPositionOf(scene, boxes[0]), [-4, 0, 0], TOLERANCE);
    checks.nearAll('em Centro a escala afasta o segundo ator do meio', worldPositionOf(scene, boxes[1]), [4, 0, 0], TOLERANCE);
    checks.nearAll('em Centro cada ator também cresce', boxes[0].transform.scale, [2, 1, 1], TOLERANCE);
}
translation();
groupTranslation();
rotation();
pivotModes();
scaling();
groupScaling();
checks.finish();
