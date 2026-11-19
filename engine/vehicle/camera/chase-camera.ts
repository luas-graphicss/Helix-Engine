import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VehicleInstance } from '../runtime/vehicle-instance';
const DISTANCE_PER_EXTENT = 2.4;
const MIN_DISTANCE = 4.5;
const HEIGHT_PER_EXTENT = 0.8;
const MIN_HEIGHT = 1.6;
const LOOK_HEIGHT_RATIO = 0.35;
const TURN_RATE = 4;
const FULL_TURN = 2 * Math.PI;
const UNIT_Z = vec3.create(0, 0, 1);
const focus = vec3.create();
const heading = vec3.create();
function shortestTurn(angle: number): number {
    return ((((angle + Math.PI) % FULL_TURN) + FULL_TURN) % FULL_TURN) - Math.PI;
}
export class ChaseCamera {
    private yaw: number | null = null;
    constructor(private readonly camera: PerspectiveCamera) { }
    follow(vehicle: VehicleInstance, deltaSeconds: number): void {
        const { body, entity } = vehicle;
        const { position, target } = this.camera;
        mat4.getTranslation(focus, entity.worldMatrix);
        body.localDirectionToWorld(heading, UNIT_Z);
        const headingYaw = Math.atan2(heading[0], heading[2]);
        const yaw = this.yaw === null ? headingYaw : this.yaw + shortestTurn(headingYaw - this.yaw) * (1 - Math.exp(-TURN_RATE * deltaSeconds));
        const distance = Math.max(MIN_DISTANCE, body.maxExtent * DISTANCE_PER_EXTENT);
        const height = Math.max(MIN_HEIGHT, body.maxExtent * HEIGHT_PER_EXTENT);
        this.yaw = yaw;
        vec3.set(position, focus[0] - Math.sin(yaw) * distance, focus[1] + height, focus[2] - Math.cos(yaw) * distance);
        vec3.set(target, focus[0], focus[1] + height * LOOK_HEIGHT_RATIO, focus[2]);
    }
}
