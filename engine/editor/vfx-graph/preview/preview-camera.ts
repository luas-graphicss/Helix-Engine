import * as mat4 from '@/engine/core/math/mat4';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
const FIELD_OF_VIEW = degToRad(40);
const NEAR = 0.05;
const FAR = 200;
const MIN_PITCH = -5;
const MAX_PITCH = 85;
const MIN_DISTANCE = 1.5;
const MAX_DISTANCE = 60;
const UP = vec3.create(0, 1, 0);
export class PreviewCamera {
    readonly view = mat4.create();
    readonly projection = mat4.create();
    readonly viewProjection = mat4.create();
    private readonly eye = vec3.create();
    private readonly target = vec3.create(0, 1.2, 0);
    private yaw = 35;
    private pitch = 14;
    private distance = 7;
    orbit(deltaYaw: number, deltaPitch: number): void {
        this.yaw = (this.yaw + deltaYaw) % 360;
        this.pitch = clamp(this.pitch + deltaPitch, MIN_PITCH, MAX_PITCH);
    }
    zoom(factor: number): void {
        this.distance = clamp(this.distance * factor, MIN_DISTANCE, MAX_DISTANCE);
    }
    update(aspect: number): void {
        const yaw = degToRad(this.yaw);
        const pitch = degToRad(this.pitch);
        const reach = Math.cos(pitch) * this.distance;
        vec3.set(this.eye, this.target[0] + Math.sin(yaw) * reach, this.target[1] + Math.sin(pitch) * this.distance, this.target[2] + Math.cos(yaw) * reach);
        mat4.lookAt(this.view, this.eye, this.target, UP);
        mat4.perspective(this.projection, FIELD_OF_VIEW, Math.max(aspect, 0.001), NEAR, FAR);
        mat4.multiply(this.viewProjection, this.projection, this.view);
    }
}
