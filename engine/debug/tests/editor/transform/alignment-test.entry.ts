import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { alignmentOffsets, applyAxisOffsets, distributionOffsets, measureAlignmentBox, type AlignmentBox } from '@/engine/editor/transform/alignment/selection-alignment';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../../support/check-list';
import { worldPositionOf, type Triple } from './transform-fixture';
const TOLERANCE = 1e-4;
const X = 0;
const Y = 1;
const checks = createCheckList('Alinhar e distribuir a seleção');
function addBox(scene: Scene, name: string, size: Triple, position: Triple, parent: Entity = scene.root): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh: createBox(...size) }, parent);
    vec3.set(entity.transform.position, ...position);
    return entity;
}
function measure(scene: Scene, entities: readonly Entity[]): AlignmentBox[] {
    scene.updateWorldMatrices();
    return entities.map((entity) => measureAlignmentBox(scene, entity));
}
function shelf(): { scene: Scene; small: Entity; medium: Entity; large: Entity } {
    const scene = new Scene();
    const small = addBox(scene, 'Pequena', [1, 1, 1], [0, 0, 0]);
    const medium = addBox(scene, 'Média', [2, 2, 2], [4, 3, 1]);
    const large = addBox(scene, 'Grande', [3, 3, 3], [10, -2, 5]);
    return { scene, small, medium, large };
}
function alignment(): void {
    const { scene, small, medium, large } = shelf();
    const boxes = measure(scene, [small, medium, large]);
    const reference = boxes[2];
    const changes = applyAxisOffsets(boxes, alignmentOffsets(boxes, reference, X, 'min'), X);
    checks.nearAll('pelo mínimo, o lado de menor X de cada ator encosta no do principal', [worldPositionOf(scene, small)[0], worldPositionOf(scene, medium)[0]], [9, 9.5], TOLERANCE);
    checks.nearAll('o principal não sai do lugar', worldPositionOf(scene, large), [10, -2, 5], TOLERANCE);
    checks.check('só os atores que se moveram viram alteração', changes.length === 2 && changes.every((change) => change.entity !== large));
    checks.nearAll('os outros eixos ficam como estavam', [worldPositionOf(scene, medium)[1], worldPositionOf(scene, medium)[2]], [3, 1], TOLERANCE);
    const centered = measure(scene, [small, medium, large]);
    applyAxisOffsets(centered, alignmentOffsets(centered, centered[2], Y, 'center'), Y);
    checks.nearAll('pelo centro, os centros coincidem com o do principal', [worldPositionOf(scene, small)[1], worldPositionOf(scene, medium)[1]], [-2, -2], TOLERANCE);
    const raised = measure(scene, [small, medium, large]);
    applyAxisOffsets(raised, alignmentOffsets(raised, raised[2], Y, 'max'), Y);
    checks.nearAll('pelo máximo, os topos coincidem com o do principal', [worldPositionOf(scene, small)[1], worldPositionOf(scene, medium)[1]], [-1, -1.5], TOLERANCE);
    const settled = measure(scene, [small, medium, large]);
    checks.check('alinhar o que já está alinhado não gera alteração', applyAxisOffsets(settled, alignmentOffsets(settled, settled[2], Y, 'max'), Y).length === 0);
}
function nestedAndEmpty(): void {
    const scene = new Scene();
    const mount = scene.createEntity({ name: 'Suporte', kind: 'group' });
    vec3.set(mount.transform.position, 0, 5, 0);
    vec3.set(mount.transform.rotation, 0, 90, 0);
    const lamp = addBox(scene, 'Luminária', [1, 1, 1], [2, 0, 0], mount);
    const marker = scene.createEntity({ name: 'Marcador', kind: 'group' });
    vec3.set(marker.transform.position, 6, 1, 0);
    const boxes = measure(scene, [lamp, marker]);
    checks.nearAll('um ator sem malha conta como um ponto na sua origem', [boxes[1].bounds.min[0], boxes[1].bounds.max[0]], [6, 6], TOLERANCE);
    applyAxisOffsets(boxes, alignmentOffsets(boxes, boxes[1], X, 'center'), X);
    checks.nearAll('dentro de um pai girado o ator anda no eixo do mundo', worldPositionOf(scene, lamp), [6, 5, -2], TOLERANCE);
    checks.nearAll('e a posição local muda no eixo que o pai enxerga', lamp.transform.position, [2, 0, 6], TOLERANCE);
}
function distribution(): void {
    const scene = new Scene();
    const posts = [addBox(scene, 'Poste 1', [1, 1, 1], [0, 0, 0]), addBox(scene, 'Poste 2', [1, 1, 1], [1, 0, 0]), addBox(scene, 'Poste 3', [1, 1, 1], [10, 0, 0])];
    const boxes = measure(scene, posts);
    const changes = applyAxisOffsets(boxes, distributionOffsets(boxes, X), X);
    checks.nearAll('os extremos ficam e o do meio vai para o meio', posts.map((post) => worldPositionOf(scene, post)[0]), [0, 5, 10], TOLERANCE);
    checks.check('só o ator do meio se move', changes.length === 1 && changes[0].entity === posts[1]);
    const mixed = new Scene();
    const crates = [addBox(mixed, 'Larga', [3, 1, 1], [3, 0, 0]), addBox(mixed, 'Estreita', [1, 1, 1], [0, 0, 0]), addBox(mixed, 'Média', [2, 1, 1], [10, 0, 0])];
    const mixedBoxes = measure(mixed, crates);
    applyAxisOffsets(mixedBoxes, distributionOffsets(mixedBoxes, X), X);
    checks.near('com tamanhos diferentes o que fica igual é o espaço entre os atores', worldPositionOf(mixed, crates[0])[0], 4.75, TOLERANCE);
    const after = measure(mixed, crates);
    const gaps = [after[0].bounds.min[0] - after[1].bounds.max[0], after[2].bounds.min[0] - after[0].bounds.max[0]];
    checks.near('os dois espaços medem o mesmo', gaps[0], gaps[1], TOLERANCE);
    checks.nearAll('um ator sozinho não tem o que distribuir', distributionOffsets(measure(mixed, [crates[0]]), X), [0], 0);
}
alignment();
nestedAndEmpty();
distribution();
checks.finish();
