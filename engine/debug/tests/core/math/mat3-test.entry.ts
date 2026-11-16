import * as mat3 from '@/engine/core/math/mat3';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const TOLERANCE = 1e-4;
const PROBE = vec3.create(0.3, -1.2, 2.5);
const checks = createCheckList('Matrizes 3×3');
function createRotation(): mat3.Mat3 {
    return mat3.fromQuat(mat3.create(), quat.fromEulerDegrees(quat.create(), vec3.create(20, -35, 50)));
}
function transform(matrix: mat3.Mat3, v: vec3.Vec3): vec3.Vec3 {
    return mat3.transformVec3(vec3.create(), matrix, v);
}
function construction(): void {
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, -0.5));
    const q = quat.fromAxisAngle(quat.create(), axis, 1.1);
    const rotation = createRotation();
    checks.nearAll('create devolve a identidade', mat3.create(), IDENTITY);
    checks.nearAll('identity regrava a identidade', mat3.identity(createRotation()), IDENTITY);
    checks.nearAll('copy duplica os nove valores', mat3.copy(mat3.create(), rotation), rotation);
    checks.nearAll('fromAxisAngle concorda com fromQuat', mat3.fromAxisAngle(mat3.create(), axis, 1.1), mat3.fromQuat(mat3.create(), q), TOLERANCE);
    checks.nearAll('fromQuat gira como o quatérnio', transform(mat3.fromQuat(mat3.create(), q), PROBE), quat.rotateVec3(vec3.create(), q, PROBE), TOLERANCE);
    checks.nearAll('fromScalar preenche só a diagonal', mat3.fromScalar(mat3.create(), 2.5), [2.5, 0, 0, 0, 2.5, 0, 0, 0, 2.5]);
    checks.nearAll('getColumn lê a coluna pedida', mat3.getColumn(vec3.create(), rotation, 1), [rotation[3], rotation[4], rotation[5]]);
}
function products(): void {
    const rotation = createRotation();
    const other = mat3.fromAxisAngle(mat3.create(), vec3.create(0, 0, 1), 0.4);
    const product = mat3.multiply(mat3.create(), rotation, other);
    const inverse = mat3.invert(mat3.create(), rotation);
    const sum = mat3.add(mat3.create(), mat3.fromScalar(mat3.create(), 2), mat3.fromScalar(mat3.create(), 3));
    checks.nearAll('multiply aplica primeiro o operando da direita', transform(product, PROBE), transform(rotation, transform(other, PROBE)), TOLERANCE);
    checks.nearAll('transformVec3Transposed desfaz uma rotação', mat3.transformVec3Transposed(vec3.create(), rotation, transform(rotation, PROBE)), PROBE, TOLERANCE);
    checks.nearAll('add soma elemento a elemento', sum, mat3.fromScalar(mat3.create(), 5));
    checks.check('invert devolve a inversa de uma rotação', inverse !== null);
    if (inverse)
        checks.nearAll('a matriz vezes a inversa dá a identidade', mat3.multiply(mat3.create(), rotation, inverse), IDENTITY, TOLERANCE);
    checks.check('invert recusa uma matriz singular', mat3.invert(mat3.create(), mat3.fromScalar(mat3.create(), 0)) === null);
}
function rotatedDiagonal(): void {
    const rotation = createRotation();
    const diagonal = vec3.create(2, 3, 4);
    const tensor = mat3.rotateDiagonal(mat3.create(), rotation, diagonal);
    const local = mat3.transformVec3Transposed(vec3.create(), rotation, PROBE);
    const scaled = vec3.set(vec3.create(), local[0] * diagonal[0], local[1] * diagonal[1], local[2] * diagonal[2]);
    checks.nearAll('rotateDiagonal aplica a diagonal no referencial girado', transform(tensor, PROBE), transform(rotation, scaled), TOLERANCE);
    checks.nearAll('rotateDiagonal devolve uma matriz simétrica', [tensor[1], tensor[2], tensor[5]], [tensor[3], tensor[6], tensor[7]], TOLERANCE);
}
construction();
products();
rotatedDiagonal();
checks.finish();
