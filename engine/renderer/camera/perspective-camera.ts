import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
const WORLD_UP = vec3.create(0, 1, 0);
export class PerspectiveCamera {
    readonly position = vec3.create(0, 0, 5);
    readonly target = vec3.create(0, 0, 0);
    fovDegrees = 60;
    near = 0.05;
    far = 500;
    aspect = 1;
    exposure = 1;
    readonly viewMatrix = mat4.create();
    readonly projectionMatrix = mat4.create();
    readonly viewProjectionMatrix = mat4.create();
    readonly inverseViewProjectionMatrix = mat4.create();
    invertible = true;
    updateMatrices(): void {
        mat4.lookAt(this.viewMatrix, this.position, this.target, WORLD_UP);
        mat4.perspective(this.projectionMatrix, degToRad(this.fovDegrees), this.aspect, this.near, this.far);
        mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
        this.invertible = mat4.invert(this.inverseViewProjectionMatrix, this.viewProjectionMatrix) !== null;
    }
}
