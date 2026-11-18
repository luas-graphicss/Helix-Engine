import * as vec3 from '@/engine/core/math/vec3';
import { SHORTCUT_ACTIONS, shortcutAction } from '@/engine/editor/shortcuts/shortcut-actions';
import { createGizmoFrame } from '@/engine/editor/transform/gizmo/gizmo-frame';
import type { GizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-handle';
import { toolHonorsSpace } from '@/engine/editor/transform/gizmo/gizmo-layout';
import { VIEWPORT_TOOLS } from '@/engine/editor/transform/tool-catalog';
import { createCheckList } from '../../support/check-list';
import { alongAxis, beginDrag, buildStageGizmo, createStage, onRing, type Stage } from './drag-stage';
import { createCamera, NO_SNAP, pointerAt, pointerOver, VIEWPORT_SIZE, worldAxisOf, worldPositionOf } from './transform-fixture';
const TOLERANCE = 5e-3;
const SCREEN_CENTER = VIEWPORT_SIZE / 2;
const MOVE_ARROWS = ['move.x', 'move.y', 'move.z'];
const MOVE_PLANES = ['move.yz', 'move.xz', 'move.xy'];
const AXIS_RINGS = ['rotate.x', 'rotate.y', 'rotate.z'];
const SCALE_TIPS = ['scale.x', 'scale.y', 'scale.z'];
const checks = createCheckList('Gizmos Transformar e Universal');
function angledStage(): Stage {
    return { ...createStage([0, 0, 0]), camera: createCamera([6, 5, 8]) };
}
function hasAll(layout: GizmoLayout, ids: readonly string[]): boolean {
    return ids.every((id) => layout.find(id) !== null);
}
function hasNone(layout: GizmoLayout, ids: readonly string[]): boolean {
    return ids.every((id) => layout.find(id) === null);
}
function reach(layout: GizmoLayout, id: string, point: 0 | 1, origin: vec3.Vec3): number {
    const handle = layout.find(id);
    if (!handle)
        throw new Error(`A alça ${id} deveria existir nesta vista`);
    return vec3.distance(handle.points[point], origin);
}
function transformLayout(): void {
    const { layout, frame } = buildStageGizmo(angledStage(), 'transform', 'pivot');
    checks.check('Transformar traz as setas, os anéis e a escala uniforme', hasAll(layout, [...MOVE_ARROWS, ...AXIS_RINGS, 'scale.uniform']));
    checks.check('Transformar dispensa planos, anel de tela e escala por eixo', hasNone(layout, [...MOVE_PLANES, 'move.view', 'rotate.view', ...SCALE_TIPS]));
    checks.check('os anéis ficam por dentro das pontas das setas', (layout.find('rotate.x')?.radius ?? Infinity) < reach(layout, 'move.x', 1, frame.origin));
}
function universalLayout(): void {
    const { layout, frame } = buildStageGizmo(angledStage(), 'universal', 'pivot');
    checks.check('Universal reúne todas as alças de mover, rotacionar e escalar', hasAll(layout, [...MOVE_ARROWS, ...MOVE_PLANES, ...AXIS_RINGS, 'rotate.view', ...SCALE_TIPS, 'scale.uniform']));
    checks.check('o centro do Universal é a escala uniforme', layout.find('move.view') === null);
    checks.check('a escala por eixo é um cubo solto', SCALE_TIPS.every((id) => layout.find(id)?.glyph === 'cube'));
    checks.check('os cubos de escala ficam além das pontas das setas', reach(layout, 'scale.x', 0, frame.origin) > reach(layout, 'move.x', 1, frame.origin));
    checks.check('o anel de tela envolve os cubos de escala', (layout.find('rotate.view')?.radius ?? 0) > reach(layout, 'scale.x', 0, frame.origin));
}
function transformDrags(): void {
    const stage = createStage([0, 0, 0]);
    const { scene, camera, boxes } = stage;
    const [box] = boxes;
    let grip = createGizmoFrame();
    const move = beginDrag(stage, 'transform', 'move.x', 'pivot', (frame) => {
        grip = frame;
        return pointerOver(camera, alongAxis(frame, 0, 0.6));
    });
    const grab = alongAxis(grip, 0, 0.6);
    move.drag.update(pointerOver(camera, [grab[0] + 1.25, grab[1], grab[2]]), NO_SNAP);
    checks.nearAll('a seta do Transformar move o ator no eixo', worldPositionOf(scene, box), [1.25, 0, 0], TOLERANCE);
    move.drag.restore();
    const turn = beginDrag(stage, 'transform', 'rotate.z', 'pivot', (frame) => pointerOver(camera, onRing(frame, 0)));
    turn.drag.update(pointerOver(camera, onRing(turn.frame, 90)), NO_SNAP);
    checks.nearAll('o anel do Transformar gira o ator', worldAxisOf(scene, box, 0), [0, 1, 0], TOLERANCE);
    turn.drag.restore();
    const grow = beginDrag(stage, 'transform', 'scale.uniform', 'pivot', () => pointerAt(SCREEN_CENTER, SCREEN_CENTER));
    grow.drag.update(pointerAt(SCREEN_CENTER + 200, SCREEN_CENTER), NO_SNAP);
    checks.nearAll('o cubo central do Transformar escala os três eixos', box.transform.scale, [2, 2, 2], TOLERANCE);
}
function universalDrags(): void {
    const stage = createStage([0, 0, 0]);
    const { camera, boxes } = stage;
    const [box] = boxes;
    let grip = createGizmoFrame();
    const stretch = beginDrag(stage, 'universal', 'scale.x', 'pivot', (frame) => {
        grip = frame;
        return pointerOver(camera, alongAxis(frame, 0, 1.08));
    });
    stretch.drag.update(pointerOver(camera, alongAxis(grip, 0, 2.16)), NO_SNAP);
    checks.nearAll('puxar o cubo de um eixo ao dobro da distância dobra a escala nele', box.transform.scale, [2, 1, 1], TOLERANCE);
    checks.check('a leitura do Universal mostra o eixo e o fator', stretch.drag.readout === 'X × 2,00', stretch.drag.readout);
}
function catalog(): void {
    checks.check('Transformar e Universal seguem o espaço Global ou Local', toolHonorsSpace('transform') && toolHonorsSpace('universal'));
    for (const [id, chord] of [['transform', 'y'], ['universal', 'u']] as const) {
        const tool = VIEWPORT_TOOLS.find((entry) => entry.id === id);
        checks.check(`${id} está no trilho de ferramentas`, tool !== undefined);
        if (!tool)
            continue;
        checks.check(`${id} responde à tecla ${chord.toUpperCase()}`, shortcutAction(tool.shortcut).defaults.includes(chord));
        const owners = SHORTCUT_ACTIONS.filter((entry) => entry.scope === 'editor' && entry.defaults.includes(chord));
        checks.check(`a tecla ${chord.toUpperCase()} não disputa com outra ação do editor`, owners.length === 1, owners.map((entry) => entry.id).join(', '));
    }
}
transformLayout();
universalLayout();
transformDrags();
universalDrags();
catalog();
checks.finish();
