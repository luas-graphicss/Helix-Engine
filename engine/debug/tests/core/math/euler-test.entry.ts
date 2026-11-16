import { nearestEquivalentEuler, unwrapDegreesNear } from '@/engine/core/math/euler';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const SAME_ROTATION_TOLERANCE = 1e-4;
const GIMBAL_LOCK_TOLERANCE = 1e-3;
const checks = createCheckList('Ângulos de Euler');
function rotationAgreement(a: vec3.Vec3, b: vec3.Vec3): number {
    return Math.abs(quat.dot(quat.fromEulerDegrees(quat.create(), a), quat.fromEulerDegrees(quat.create(), b)));
}
function unwrapping(): void {
    checks.near('unwrapDegreesNear soma voltas até chegar perto da referência', unwrapDegreesNear(10, 370), 370);
    checks.near('unwrapDegreesNear subtrai voltas quando a referência é menor', unwrapDegreesNear(350, -20), -10);
    checks.near('unwrapDegreesNear mantém o ângulo que já está perto', unwrapDegreesNear(45, 60), 45);
}
function equivalence(): void {
    const euler = vec3.create(20, -35, 50);
    const mirrored = nearestEquivalentEuler(vec3.create(), euler, vec3.create(205, 210, 235));
    const kept = nearestEquivalentEuler(vec3.create(), euler, vec3.create(25, -30, 45));
    checks.nearAll('nearestEquivalentEuler escolhe a forma espelhada perto da referência', mirrored, [200, 215, 230]);
    checks.near('a forma espelhada representa a mesma rotação', rotationAgreement(euler, mirrored), 1, SAME_ROTATION_TOLERANCE);
    checks.nearAll('nearestEquivalentEuler mantém os ângulos que já estão perto', kept, euler);
}
function gimbalLock(): void {
    const locked = vec3.create(30, 90, 0);
    const recovered = quat.toEulerDegrees(vec3.create(), quat.fromEulerDegrees(quat.create(), locked));
    checks.check('toEulerDegrees devolve ângulos finitos no bloqueio de eixos', recovered.every(Number.isFinite));
    checks.near('os ângulos recuperados no bloqueio de eixos representam a mesma rotação', rotationAgreement(locked, recovered), 1, GIMBAL_LOCK_TOLERANCE);
}
unwrapping();
equivalence();
gimbalLock();
checks.finish();
