import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const TOLERANCE = 1e-4;
const EULER_TOLERANCE = 1e-3;
const PROBE = vec3.create(0.3, -1.2, 2.5);
const TRANSLATION = vec3.create(4, -5, 6);
const ROTATION_DEGREES = vec3.create(20, -35, 50);
const SCALE = vec3.create(2, 3, 4);
const UNIT_SCALE = vec3.create(1, 1, 1);
const checks = createCheckList('Matrizes 4×4');
function compose(scale: vec3.Vec3 = SCALE): mat4.Mat4 {
    return mat4.fromTranslationRotationScale(mat4.create(), TRANSLATION, ROTATION_DEGREES, scale);
}
function transform(matrix: mat4.Mat4, point: vec3.Vec3): vec3.Vec3 {
    return mat4.transformPoint(vec3.create(), matrix, point);
}
function products(): void {
    const model = compose();
    const other = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(-1, 2, 0.5), vec3.create(-70, 10, 15), UNIT_SCALE);
    const product = mat4.multiply(mat4.create(), model, other);
    checks.nearAll('create devolve a identidade', mat4.create(), IDENTITY);
    checks.nearAll('identity regrava a identidade', mat4.identity(compose()), IDENTITY);
    checks.nearAll('copy duplica os dezesseis valores', mat4.copy(mat4.create(), model), model);
    checks.nearAll('multiplicar pela identidade à direita não muda a matriz', mat4.multiply(mat4.create(), model, mat4.create()), model);
    checks.nearAll('multiplicar pela identidade à esquerda não muda a matriz', mat4.multiply(mat4.create(), mat4.create(), model), model);
    checks.nearAll('multiply aplica primeiro o operando da direita', transform(product, PROBE), transform(model, transform(other, PROBE)), TOLERANCE);
}
function inversion(): void {
    const model = compose();
    const flattened = compose(vec3.create(1, 0, 1));
    const inverse = mat4.invert(mat4.create(), model);
    checks.check('invert devolve a inversa de uma transformação regular', inverse !== null);
    if (inverse)
        checks.nearAll('a matriz vezes a inversa dá a identidade', mat4.multiply(mat4.create(), model, inverse), IDENTITY, TOLERANCE);
    checks.check('invert recusa uma matriz singular', mat4.invert(mat4.create(), flattened) === null);
    checks.check('normalMatrix recusa uma matriz singular', mat4.normalMatrix(mat3.create(), flattened) === null);
}
function projection(): void {
    const near = 0.1;
    const far = 100;
    const aspect = 16 / 9;
    const fieldOfView = Math.PI / 3;
    const halfHeight = Math.tan(fieldOfView / 2) * near;
    const perspective = mat4.perspective(mat4.create(), fieldOfView, aspect, near, far);
    const ortho = mat4.ortho(mat4.create(), -2, 6, -1, 3, 0.5, 20);
    checks.nearAll('perspective leva o centro do plano próximo a z = −1', transform(perspective, vec3.create(0, 0, -near)), [0, 0, -1], TOLERANCE);
    checks.nearAll('perspective leva o centro do plano distante a z = 1', transform(perspective, vec3.create(0, 0, -far)), [0, 0, 1], TOLERANCE);
    checks.nearAll('perspective leva o canto do plano próximo ao canto do cubo', transform(perspective, vec3.create(halfHeight * aspect, halfHeight, -near)), [1, 1, -1], TOLERANCE);
    checks.nearAll('ortho leva o canto mínimo do volume a −1', transform(ortho, vec3.create(-2, -1, -0.5)), [-1, -1, -1], TOLERANCE);
    checks.nearAll('ortho leva o canto máximo do volume a 1', transform(ortho, vec3.create(6, 3, -20)), [1, 1, 1], TOLERANCE);
}
function camera(): void {
    const eye = vec3.create(3, 4, 5);
    const target = vec3.create(-1, 0.5, -2);
    const up = vec3.create(0, 1, 0);
    const view = mat4.lookAt(mat4.create(), eye, target, up);
    checks.nearAll('lookAt leva o olho à origem', transform(view, eye), [0, 0, 0], TOLERANCE);
    checks.nearAll('lookAt põe o alvo no eixo −Z à distância do olho', transform(view, target), [0, 0, -vec3.distance(eye, target)], TOLERANCE);
    checks.check('lookAt mantém o vetor para cima do lado de +Y', mat4.transformDirection(vec3.create(), view, up)[1] > 0);
}
function decomposition(): void {
    const model = compose();
    const mirrored = compose(vec3.create(-2, 3, 4));
    const translation = vec3.create();
    const rotation = vec3.create();
    const scale = vec3.create();
    mat4.decomposeTranslationRotationScale(translation, rotation, scale, model);
    checks.nearAll('decompose recupera a translação', translation, TRANSLATION);
    checks.nearAll('decompose recupera a rotação em graus', rotation, ROTATION_DEGREES, EULER_TOLERANCE);
    checks.nearAll('decompose recupera a escala', scale, SCALE, TOLERANCE);
    checks.nearAll('getTranslation lê a quarta coluna', mat4.getTranslation(vec3.create(), model), TRANSLATION);
    checks.near('maxAxisScale devolve a maior escala entre os eixos', mat4.maxAxisScale(model), 4, TOLERANCE);
    mat4.decomposeTranslationRotationScale(translation, rotation, scale, mirrored);
    checks.check('decompose devolve escala negativa em X para uma matriz espelhada', scale[0] < 0);
    checks.nearAll('recompor a decomposição da matriz espelhada devolve a original', mat4.fromTranslationRotationScale(mat4.create(), translation, rotation, scale), mirrored, TOLERANCE);
}
function rotations(): void {
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, -0.5));
    const aroundAxis = mat4.fromAxisAngle(mat4.create(), axis, 1.1);
    const orientation = mat3.fromQuat(mat3.create(), quat.fromEulerDegrees(quat.create(), ROTATION_DEGREES));
    const translationOnly = mat4.fromTranslationRotationScale(mat4.create(), TRANSLATION, vec3.create(), UNIT_SCALE);
    checks.nearAll('fromAxisAngle concorda com vec3.rotateAroundAxis', mat4.transformDirection(vec3.create(), aroundAxis, PROBE), vec3.rotateAroundAxis(vec3.create(), PROBE, axis, 1.1), TOLERANCE);
    checks.nearAll('fromRotationDegrees é a composição sem translação e com escala um', mat4.fromRotationDegrees(mat4.create(), ROTATION_DEGREES), mat4.fromTranslationRotationScale(mat4.create(), vec3.create(), ROTATION_DEGREES, UNIT_SCALE));
    checks.nearAll('fromTranslationMat3Scale concorda com a composição por ângulos', mat4.fromTranslationMat3Scale(mat4.create(), TRANSLATION, orientation, SCALE), compose(), TOLERANCE);
    checks.nearAll('transformPoint soma a translação', transform(translationOnly, PROBE), vec3.add(vec3.create(), PROBE, TRANSLATION));
    checks.nearAll('transformDirection ignora a translação', mat4.transformDirection(vec3.create(), translationOnly, PROBE), PROBE);
}
function surfaceNormals(): void {
    const model = compose();
    const normalMatrix = mat4.normalMatrix(mat3.create(), model);
    const tangent = vec3.create(1, 2, -0.5);
    const normal = vec3.cross(vec3.create(), tangent, vec3.create(0, 0, 1));
    checks.check('normalMatrix existe para uma transformação regular', normalMatrix !== null);
    if (!normalMatrix)
        return;
    const worldTangent = mat4.transformDirection(vec3.create(), model, tangent);
    const worldNormal = mat3.transformVec3(vec3.create(), normalMatrix, normal);
    checks.near('normalMatrix mantém a normal perpendicular à superfície sob escala não uniforme', vec3.dot(worldNormal, worldTangent), 0, EULER_TOLERANCE);
}
products();
inversion();
projection();
camera();
decomposition();
rotations();
surfaceNormals();
checks.finish();
