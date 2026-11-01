import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
const FACE_FORWARD: readonly (readonly [
    number,
    number,
    number
])[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];
const FACE_UP: readonly (readonly [
    number,
    number,
    number
])[] = [
    [0, -1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0, -1, 0],
    [0, -1, 0],
];
export class CubeFaceCamera extends PerspectiveCamera {
    private readonly forward: Float32Array;
    private readonly up: Float32Array;
    constructor(readonly face: number) {
        super();
        const [fx, fy, fz] = FACE_FORWARD[face];
        const [ux, uy, uz] = FACE_UP[face];
        this.forward = vec3.create(fx, fy, fz);
        this.up = vec3.create(ux, uy, uz);
        this.fovDegrees = 90;
        this.aspect = 1;
    }
    override updateMatrices(): void {
        vec3.add(this.target, this.position, this.forward);
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
        mat4.perspective(this.projectionMatrix, Math.PI / 2, 1, this.near, this.far);
        mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
        this.invertible = mat4.invert(this.inverseViewProjectionMatrix, this.viewProjectionMatrix) !== null;
    }
}
