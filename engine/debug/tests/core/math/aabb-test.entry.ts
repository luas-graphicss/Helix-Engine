import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createCheckList } from '../../support/check-list';
const TOLERANCE = 1e-4;
const CORNER_COUNT = 8;
const UNIT_SCALE = vec3.create(1, 1, 1);
const checks = createCheckList('Caixas alinhadas aos eixos');
type Triple = [number, number, number];
function createBox(min: Triple, max: Triple): aabb.Aabb {
    return { min: vec3.create(...min), max: vec3.create(...max) };
}
function corner(box: aabb.Aabb, index: number): vec3.Vec3 {
    return vec3.create(index & 1 ? box.max[0] : box.min[0], index & 2 ? box.max[1] : box.min[1], index & 4 ? box.max[2] : box.min[2]);
}
function boundsOfTransformedCorners(box: aabb.Aabb, matrix: mat4.Mat4): aabb.Aabb {
    const bounds = aabb.create();
    for (let index = 0; index < CORNER_COUNT; index++) {
        const point = mat4.transformPoint(vec3.create(), matrix, corner(box, index));
        aabb.union(bounds, bounds, { min: point, max: point });
    }
    return bounds;
}
function emptiness(): void {
    const filled = createBox([-1, -2, -3], [1, 2, 3]);
    const joined = aabb.union(aabb.create(), aabb.create(), filled);
    checks.check('create devolve uma caixa vazia', aabb.isEmpty(aabb.create()));
    checks.check('uma caixa com volume não é vazia', !aabb.isEmpty(filled));
    checks.check('reset esvazia a caixa', aabb.isEmpty(aabb.reset(createBox([-1, -2, -3], [1, 2, 3]))));
    checks.nearAll('unir com a caixa vazia mantém o mínimo da outra', joined.min, filled.min);
    checks.nearAll('unir com a caixa vazia mantém o máximo da outra', joined.max, filled.max);
}
function measures(): void {
    const box = createBox([-1, 0, 2], [3, 4, 8]);
    checks.nearAll('center devolve o ponto médio', aabb.center(vec3.create(), box), [1, 2, 5]);
    checks.near('halfDiagonal devolve metade da diagonal', aabb.halfDiagonal(box), Math.hypot(4, 4, 6) / 2);
    checks.near('distanceToPoint é zero dentro da caixa', aabb.distanceToPoint(box, vec3.create(0, 1, 3)), 0);
    checks.near('distanceToPoint mede até a face mais próxima', aabb.distanceToPoint(box, vec3.create(6, 1, 3)), 3);
    checks.near('distanceToPoint mede até o canto mais próximo', aabb.distanceToPoint(box, vec3.create(6, 8, 12)), Math.hypot(3, 4, 4));
}
function overlap(): void {
    const box = createBox([0, 0, 0], [2, 2, 2]);
    const joined = aabb.union(aabb.create(), box, createBox([-1, 1, 1], [1, 5, 3]));
    checks.check('caixas sobrepostas se intersectam', aabb.intersects(box, createBox([1, 1, 1], [3, 3, 3])));
    checks.check('caixas que só se tocam em uma face se intersectam', aabb.intersects(box, createBox([2, 0, 0], [4, 2, 2])));
    checks.check('caixas separadas em um eixo não se intersectam', !aabb.intersects(box, createBox([0, 0, 2.5], [2, 2, 4])));
    checks.nearAll('union cobre o mínimo das duas caixas', joined.min, [-1, 0, 0]);
    checks.nearAll('union cobre o máximo das duas caixas', joined.max, [2, 5, 3]);
}
function transformation(): void {
    const box = createBox([-1, -2, -3], [1, 2, 3]);
    const translation = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(10, 20, 30), vec3.create(), UNIT_SCALE);
    const quarterTurn = mat4.fromRotationDegrees(mat4.create(), vec3.create(0, 90, 0));
    const general = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(4, -5, 6), vec3.create(20, -35, 50), vec3.create(2, 3, 4));
    const moved = aabb.transform(aabb.create(), box, translation);
    const turned = aabb.transform(aabb.create(), box, quarterTurn);
    const transformed = aabb.transform(aabb.create(), box, general);
    const expected = boundsOfTransformedCorners(box, general);
    checks.nearAll('transform translada o mínimo', moved.min, [9, 18, 27]);
    checks.nearAll('transform translada o máximo', moved.max, [11, 22, 33]);
    checks.nearAll('um quarto de volta em Y troca as extensões de X e Z no mínimo', turned.min, [-3, -2, -1], TOLERANCE);
    checks.nearAll('um quarto de volta em Y troca as extensões de X e Z no máximo', turned.max, [3, 2, 1], TOLERANCE);
    checks.nearAll('transform devolve o mínimo dos oito cantos transformados', transformed.min, expected.min, TOLERANCE);
    checks.nearAll('transform devolve o máximo dos oito cantos transformados', transformed.max, expected.max, TOLERANCE);
}
emptiness();
measures();
overlap();
transformation();
checks.finish();
