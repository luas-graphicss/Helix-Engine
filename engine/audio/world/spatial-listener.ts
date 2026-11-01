import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
const WORLD_UP = vec3.create(0, 1, 0);
const FALLBACK_RIGHT = vec3.create(1, 0, 0);
const SMOOTHING_SECONDS = 0.02;
const MAX_SPEED = 80;
const VELOCITY_SMOOTHING = 0.25;
const right = vec3.create();
const delta = vec3.create();
export class SpatialListener {
    readonly position = vec3.create();
    readonly forward = vec3.create(0, 0, -1);
    readonly up = vec3.create(0, 1, 0);
    readonly velocity = vec3.create();
    private initialized = false;
    constructor(private readonly context: AudioContext) { }
    update(position: Vec3, target: Vec3, deltaSeconds: number): void {
        if (this.initialized && deltaSeconds > 0) {
            vec3.subtract(delta, position, this.position);
            vec3.scale(delta, delta, 1 / deltaSeconds);
            if (vec3.length(delta) > MAX_SPEED)
                vec3.set(delta, 0, 0, 0);
            vec3.set(this.velocity, this.velocity[0] + (delta[0] - this.velocity[0]) * VELOCITY_SMOOTHING, this.velocity[1] + (delta[1] - this.velocity[1]) * VELOCITY_SMOOTHING, this.velocity[2] + (delta[2] - this.velocity[2]) * VELOCITY_SMOOTHING);
        }
        vec3.copy(this.position, position);
        vec3.subtract(delta, target, position);
        if (vec3.length(delta) > 1e-5)
            vec3.normalize(this.forward, delta);
        vec3.cross(right, this.forward, WORLD_UP);
        if (vec3.length(right) < 1e-4)
            vec3.copy(right, FALLBACK_RIGHT);
        vec3.normalize(right, right);
        vec3.cross(this.up, right, this.forward);
        vec3.normalize(this.up, this.up);
        this.write(!this.initialized);
        this.initialized = true;
    }
    private write(immediate: boolean): void {
        const { listener } = this.context;
        const now = this.context.currentTime;
        if ('positionX' in listener && listener.positionX) {
            const params: Array<[
                AudioParam,
                number
            ]> = [
                [listener.positionX, this.position[0]],
                [listener.positionY, this.position[1]],
                [listener.positionZ, this.position[2]],
                [listener.forwardX, this.forward[0]],
                [listener.forwardY, this.forward[1]],
                [listener.forwardZ, this.forward[2]],
                [listener.upX, this.up[0]],
                [listener.upY, this.up[1]],
                [listener.upZ, this.up[2]],
            ];
            for (const [param, value] of params) {
                if (immediate) {
                    param.cancelScheduledValues(now);
                    param.setValueAtTime(value, now);
                }
                else {
                    param.setTargetAtTime(value, now, SMOOTHING_SECONDS);
                }
            }
            return;
        }
        listener.setPosition(this.position[0], this.position[1], this.position[2]);
        listener.setOrientation(this.forward[0], this.forward[1], this.forward[2], this.up[0], this.up[1], this.up[2]);
    }
}
