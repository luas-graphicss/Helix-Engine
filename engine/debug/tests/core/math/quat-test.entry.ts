import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const IDENTITY = [0, 0, 0, 1];
const AXIS_Y = vec3.create(0, 1, 0);
const QUARTER_TURN = Math.PI / 2;
const ROTATION_TOLERANCE = 1e-4;
const EULER_TOLERANCE = 1e-3;
const INTEGRATION_STEPS = 1000;
const INTEGRATION_TOLERANCE = 1e-3;
const PROBE = vec3.create(0.3, -1.2, 2.5);
const checks = createCheckList('Quatérnios');
function fromEuler(x: number, y: number, z: number): quat.Quat {
    return quat.fromEulerDegrees(quat.create(), vec3.create(x, y, z));
}
function rotate(q: quat.Quat, v: vec3.Vec3 = PROBE): vec3.Vec3 {
    return quat.rotateVec3(vec3.create(), q, v);
}
function norm(q: quat.Quat): number {
    return Math.hypot(q[0], q[1], q[2], q[3]);
}
function axisAngle(): void {
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, -0.5));
    const q = quat.fromAxisAngle(quat.create(), axis, 1.1);
    const quarterTurn = quat.fromAxisAngle(quat.create(), AXIS_Y, QUARTER_TURN);
    checks.nearAll('create devolve a identidade', quat.create(), IDENTITY);
    checks.nearAll('identity regrava a identidade', quat.identity(fromEuler(20, -35, 50)), IDENTITY);
    checks.nearAll('a identidade não gira o vetor', rotate(quat.create()), PROBE);
    checks.nearAll('fromAxisAngle leva +X a −Z em um quarto de volta em Y', rotate(quarterTurn, vec3.create(1, 0, 0)), [0, 0, -1]);
    checks.nearAll('rotateVec3 concorda com vec3.rotateAroundAxis', rotate(q), vec3.rotateAroundAxis(vec3.create(), PROBE, axis, 1.1), ROTATION_TOLERANCE);
    checks.near('fromAxisAngle devolve norma um', norm(q), 1);
}
function composition(): void {
    const a = fromEuler(20, -35, 50);
    const b = fromEuler(-70, 10, 15);
    const product = quat.multiply(quat.create(), a, b);
    const inverse = quat.conjugate(quat.create(), a);
    checks.nearAll('multiply aplica primeiro o operando da direita', rotate(product), rotate(a, rotate(b)), ROTATION_TOLERANCE);
    checks.nearAll('conjugate desfaz a rotação', rotate(inverse, rotate(a)), PROBE, ROTATION_TOLERANCE);
    checks.nearAll('um quatérnio unitário vezes o conjugado dá a identidade', quat.multiply(quat.create(), a, inverse), IDENTITY);
    checks.near('dot de um quatérnio unitário consigo mesmo é um', quat.dot(a, a), 1);
    checks.nearAll('copy duplica as quatro componentes', quat.copy(quat.create(), a), a);
    checks.near('normalize devolve norma um', norm(quat.normalize(quat.create(), quat.set(quat.create(), 1, 2, 3, 4))), 1);
    checks.nearAll('normalize do quatérnio nulo devolve a identidade', quat.normalize(quat.create(), quat.set(quat.create(), 0, 0, 0, 0)), IDENTITY);
}
function eulerAngles(): void {
    const degrees = vec3.create(20, -35, 50);
    const q = quat.fromEulerDegrees(quat.create(), degrees);
    const matrix = mat4.fromRotationDegrees(mat4.create(), degrees);
    const scaled = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(4, 5, 6), degrees, vec3.create(2, 3, 4));
    const wrapped = quat.toEulerDegreesNear(vec3.create(), fromEuler(-10, 10, 0), vec3.create(350, 10, 0));
    checks.nearAll('fromEulerDegrees concorda com mat4.fromRotationDegrees', rotate(q), mat4.transformDirection(vec3.create(), matrix, PROBE), ROTATION_TOLERANCE);
    checks.nearAll('toEulerDegrees desfaz fromEulerDegrees', quat.toEulerDegrees(vec3.create(), q), degrees, EULER_TOLERANCE);
    checks.nearAll('fromMat4Rotation recupera a rotação da matriz', rotate(quat.fromMat4Rotation(quat.create(), matrix)), rotate(q), ROTATION_TOLERANCE);
    checks.nearAll('fromMat4Rotation ignora translação e escala', rotate(quat.fromMat4Rotation(quat.create(), scaled)), rotate(q), ROTATION_TOLERANCE);
    checks.nearAll('toEulerDegreesNear escolhe os ângulos mais próximos da referência', wrapped, [350, 10, 0], EULER_TOLERANCE);
}
function interpolation(): void {
    const start = fromEuler(0, 20, 0);
    const end = fromEuler(0, 100, 0);
    const negatedEnd = quat.set(quat.create(), -end[0], -end[1], -end[2], -end[3]);
    const halfway = quat.nlerp(quat.create(), start, end, 0.5);
    checks.nearAll('nlerp em zero devolve o início', quat.nlerp(quat.create(), start, end, 0), start);
    checks.nearAll('nlerp em um devolve o fim', quat.nlerp(quat.create(), start, end, 1), end);
    checks.nearAll('nlerp no meio fica a meio caminho da rotação', rotate(halfway), rotate(fromEuler(0, 60, 0)), ROTATION_TOLERANCE);
    checks.nearAll('nlerp segue o caminho curto quando o fim tem o sinal trocado', quat.nlerp(quat.create(), start, negatedEnd, 0.5), halfway);
}
function integration(): void {
    const angularVelocity = vec3.create(0, QUARTER_TURN, 0);
    const still = fromEuler(20, -35, 50);
    const q = quat.create();
    for (let step = 0; step < INTEGRATION_STEPS; step++)
        quat.integrate(q, q, angularVelocity, 1 / INTEGRATION_STEPS);
    checks.nearAll('integrate acumula a velocidade angular ao longo de um segundo', rotate(q), rotate(quat.fromAxisAngle(quat.create(), AXIS_Y, QUARTER_TURN)), INTEGRATION_TOLERANCE);
    checks.near('integrate mantém a norma em um', norm(q), 1);
    checks.nearAll('integrate sem velocidade angular não muda a orientação', quat.integrate(quat.create(), still, vec3.create(), 1 / 60), still);
}
axisAngle();
composition();
eulerAngles();
interpolation();
integration();
checks.finish();
