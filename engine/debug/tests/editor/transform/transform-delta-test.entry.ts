import { degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { applyTransformDelta } from '@/engine/editor/transform/apply/apply-transform-delta';
import { captureTargetState, hasTargetChanged, restoreTargetState } from '@/engine/editor/transform/apply/target-state';
import { createTransformDelta, type TransformDelta } from '@/engine/editor/transform/apply/transform-delta';
import { createCheckList } from '../../support/check-list';
import { worldAxisOf, worldPositionOf } from './transform-fixture';
const TOLERANCE = 1e-4;
const QUARTER_TURN = degToRad(90);
const checks = createCheckList('Transformação aplicada a atores');
interface Fixture {
    scene: Scene;
    child: Entity;
}
function createFixture(): Fixture {
    const scene = new Scene();
    const parent = scene.createEntity({ name: 'Suporte', kind: 'group' });
    vec3.set(parent.transform.position, 10, 0, 0);
    vec3.set(parent.transform.rotation, 0, 90, 0);
    const child = scene.createEntity({ name: 'Caixa', kind: 'group' }, parent);
    vec3.set(child.transform.position, 1, 2, 0);
    scene.updateWorldMatrices();
    return { scene, child };
}
function applyTo({ child }: Fixture, configure: (delta: TransformDelta) => void): void {
    const delta = createTransformDelta();
    configure(delta);
    applyTransformDelta(captureTargetState(child), delta);
}
function translation(): void {
    const fixture = createFixture();
    const { scene, child } = fixture;
    checks.nearAll('o ator começa onde o pai girado o coloca', worldPositionOf(scene, child), [10, 2, -1], TOLERANCE);
    applyTo(fixture, (delta) => vec3.set(delta.translation, 0, 0, 2));
    checks.nearAll('o deslocamento vale no mundo mesmo com o pai girado', worldPositionOf(scene, child), [10, 2, 1], TOLERANCE);
    checks.nearAll('mover não toca na rotação', child.transform.rotation, [0, 0, 0], 0);
    checks.nearAll('mover não toca na escala', child.transform.scale, [1, 1, 1], 0);
}
function rotation(): void {
    const own = createFixture();
    applyTo(own, (delta) => {
        vec3.set(delta.rotationAxis, 0, 1, 0);
        delta.rotationAngle = QUARTER_TURN;
    });
    checks.nearAll('girar no próprio pivô mantém a posição', worldPositionOf(own.scene, own.child), [10, 2, -1], TOLERANCE);
    checks.nearAll('girar no próprio pivô vira os eixos no mundo', worldAxisOf(own.scene, own.child, 0), [-1, 0, 0], TOLERANCE);
    checks.nearAll('girar não toca na escala', own.child.transform.scale, [1, 1, 1], 0);
    const shared = createFixture();
    applyTo(shared, (delta) => {
        vec3.set(delta.rotationAxis, 0, 1, 0);
        delta.rotationAngle = QUARTER_TURN;
        delta.sharedPivot = true;
    });
    checks.nearAll('girar em torno do pivô comum faz o ator orbitar', worldPositionOf(shared.scene, shared.child), [-1, 2, -10], TOLERANCE);
    checks.nearAll('orbitar também vira os eixos', worldAxisOf(shared.scene, shared.child, 0), [-1, 0, 0], TOLERANCE);
}
function scaling(): void {
    const own = createFixture();
    applyTo(own, (delta) => {
        delta.scale[2] = 2;
    });
    checks.nearAll('a escala vai para o eixo local mais alinhado ao eixo do gizmo', own.child.transform.scale, [2, 1, 1], TOLERANCE);
    checks.nearAll('escalar no próprio pivô mantém a posição', worldPositionOf(own.scene, own.child), [10, 2, -1], TOLERANCE);
    const shared = createFixture();
    applyTo(shared, (delta) => {
        delta.scale[2] = 2;
        delta.sharedPivot = true;
    });
    checks.nearAll('escalar em torno do pivô comum afasta o ator nesse eixo', worldPositionOf(shared.scene, shared.child), [10, 2, -2], TOLERANCE);
    const uniform = createFixture();
    applyTo(uniform, (delta) => vec3.set(delta.scale, 3, 3, 3));
    checks.nearAll('a escala uniforme multiplica os três eixos', uniform.child.transform.scale, [3, 3, 3], TOLERANCE);
}
function repeatedApplication(): void {
    const { scene, child } = createFixture();
    const state = captureTargetState(child);
    const delta = createTransformDelta();
    checks.check('um ator intocado não conta como alterado', !hasTargetChanged(state));
    vec3.set(delta.translation, 5, 0, 0);
    applyTransformDelta(state, delta);
    vec3.set(delta.translation, 1, 0, 0);
    applyTransformDelta(state, delta);
    checks.nearAll('cada aplicação parte do estado inicial, sem acumular', worldPositionOf(scene, child), [11, 2, -1], TOLERANCE);
    checks.check('um ator movido conta como alterado', hasTargetChanged(state));
    restoreTargetState(state);
    checks.nearAll('restaurar devolve a posição local', child.transform.position, [1, 2, 0], 0);
}
translation();
rotation();
scaling();
repeatedApplication();
checks.finish();
