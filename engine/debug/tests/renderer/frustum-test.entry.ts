import type { Aabb } from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { CULL_INSIDE, CULL_INTERSECTS, CULL_OUTSIDE, Frustum } from '@/engine/renderer/culling/frustum';
import { createCheckList } from '../support/check-list';
const NEAR = 0.1;
const FAR = 100;
const FIELD_OF_VIEW = Math.PI / 3;
const ASPECT = 16 / 9;
const CAMERA_DISTANCE = 5;
const GRID_EXTENT = 60;
const GRID_STEP = 15;
const checks = createCheckList('Volume de visão da câmera');
function createCameraFrustum(): Frustum {
    const projection = mat4.perspective(mat4.create(), FIELD_OF_VIEW, ASPECT, NEAR, FAR);
    const view = mat4.lookAt(mat4.create(), vec3.create(0, 0, CAMERA_DISTANCE), vec3.create(), vec3.create(0, 1, 0));
    return new Frustum().setFromViewProjection(mat4.multiply(mat4.create(), projection, view));
}
function boxAt(x: number, y: number, z: number, halfSize = 0.5): Aabb {
    return { min: vec3.create(x - halfSize, y - halfSize, z - halfSize), max: vec3.create(x + halfSize, y + halfSize, z + halfSize) };
}
function agreesOnEveryGridBox(frustum: Frustum): boolean {
    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_STEP) {
        for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += GRID_STEP) {
            for (let z = -GRID_EXTENT; z <= GRID_EXTENT; z += GRID_STEP) {
                const box = boxAt(x, y, z, GRID_STEP / 2);
                if (frustum.intersectsAabb(box) !== (frustum.classifyAabb(box) !== CULL_OUTSIDE))
                    return false;
            }
        }
    }
    return true;
}
function boxes(): void {
    const frustum = createCameraFrustum();
    checks.check('uma caixa diante da câmera fica inteira dentro', frustum.classifyAabb(boxAt(0, 0, 0)) === CULL_INSIDE);
    checks.check('uma caixa atrás da câmera fica fora', frustum.classifyAabb(boxAt(0, 0, 20)) === CULL_OUTSIDE);
    checks.check('uma caixa além do plano distante fica fora', frustum.classifyAabb(boxAt(0, 0, -200)) === CULL_OUTSIDE);
    checks.check('uma caixa muito à esquerda fica fora', frustum.classifyAabb(boxAt(-100, 0, 0)) === CULL_OUTSIDE);
    checks.check('uma caixa muito acima fica fora', frustum.classifyAabb(boxAt(0, 100, 0)) === CULL_OUTSIDE);
    checks.check('uma caixa que envolve a câmera cruza o volume', frustum.classifyAabb(boxAt(0, 0, CAMERA_DISTANCE, 50)) === CULL_INTERSECTS);
    checks.check('uma caixa atravessada pelo plano próximo cruza o volume', frustum.classifyAabb(boxAt(0, 0, CAMERA_DISTANCE - NEAR, 0.2)) === CULL_INTERSECTS);
    checks.check('intersectsAabb só descarta o que classifyAabb põe fora', agreesOnEveryGridBox(frustum));
}
function spheres(): void {
    const frustum = createCameraFrustum();
    const besideLeftPlane = vec3.create(-6, 0, 0);
    checks.check('uma esfera diante da câmera é visível', frustum.intersectsSphere(vec3.create(), 1));
    checks.check('uma esfera atrás da câmera não é visível', !frustum.intersectsSphere(vec3.create(0, 0, 20), 1));
    checks.check('uma esfera fora do plano esquerdo que alcança o volume é visível', frustum.intersectsSphere(besideLeftPlane, 1));
    checks.check('uma esfera fora do plano esquerdo que não alcança o volume não é visível', !frustum.intersectsSphere(besideLeftPlane, 0.3));
}
boxes();
spheres();
checks.finish();
