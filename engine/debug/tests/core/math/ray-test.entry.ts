import type { Aabb } from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import { createRay, intersectRayAabb, transformRay, type Ray } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const TOLERANCE = 1e-4;
const UNIT_SCALE = vec3.create(1, 1, 1);
const BOX: Aabb = { min: vec3.create(-1, -1, -1), max: vec3.create(1, 1, 1) };
const checks = createCheckList('Raios');
type Triple = [number, number, number];
function rayFrom(origin: Triple, direction: Triple): Ray {
    return { origin: vec3.create(...origin), direction: vec3.normalize(vec3.create(), vec3.create(...direction)) };
}
function hitDistance(ray: Ray): number {
    return intersectRayAabb(ray, BOX) ?? Number.NaN;
}
function intersection(): void {
    const initial = createRay();
    checks.nearAll('createRay parte da origem', initial.origin, [0, 0, 0]);
    checks.nearAll('createRay aponta para −Z', initial.direction, [0, 0, -1]);
    checks.near('um raio de fora acerta a face mais próxima', hitDistance(rayFrom([0, 0, 5], [0, 0, -1])), 4);
    checks.near('um raio de dentro devolve a distância de saída', hitDistance(rayFrom([0, 0, 0], [1, 0, 0])), 1);
    checks.near('um raio diagonal acerta o canto', hitDistance(rayFrom([3, 3, 3], [-1, -1, -1])), Math.hypot(2, 2, 2), TOLERANCE);
    checks.near('um raio paralelo a duas faces e dentro da fatia acerta', hitDistance(rayFrom([0, 0.5, 5], [0, 0, -1])), 4);
    checks.check('um raio que se afasta da caixa não acerta', intersectRayAabb(rayFrom([0, 0, 5], [0, 0, 1]), BOX) === null);
    checks.check('um raio paralelo fora da fatia não acerta', intersectRayAabb(rayFrom([0, 3, 5], [0, 0, -1]), BOX) === null);
    checks.check('um raio que passa ao lado da caixa não acerta', intersectRayAabb(rayFrom([5, 5, 5], [-1, 0, -1]), BOX) === null);
}
function transformation(): void {
    const ray = rayFrom([1, 2, 3], [0, 0, -1]);
    const translation = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(10, 20, 30), vec3.create(), UNIT_SCALE);
    const quarterTurn = mat4.fromRotationDegrees(mat4.create(), vec3.create(0, 90, 0));
    const moved = transformRay(createRay(), ray, translation);
    const turned = transformRay(createRay(), ray, quarterTurn);
    const aliased = rayFrom([1, 2, 3], [0, 0, -1]);
    transformRay(aliased, aliased, quarterTurn);
    checks.nearAll('transformRay translada a origem', moved.origin, [11, 22, 33]);
    checks.nearAll('transformRay não translada a direção', moved.direction, [0, 0, -1]);
    checks.nearAll('transformRay gira a origem', turned.origin, [3, 2, -1], TOLERANCE);
    checks.nearAll('transformRay gira a direção', turned.direction, [-1, 0, 0], TOLERANCE);
    checks.nearAll('transformRay aceita a saída no mesmo raio da entrada', [...aliased.origin, ...aliased.direction], [...turned.origin, ...turned.direction]);
}
intersection();
transformation();
checks.finish();
