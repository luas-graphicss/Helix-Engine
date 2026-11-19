import { clamp } from '@/engine/core/math/scalar';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { NavAvoidanceQuality } from './nav-agent-settings';
export interface AvoidanceParams {
    readonly divisions: number;
    readonly rings: number;
    readonly depth: number;
}
export const AVOIDANCE_PARAMS: Record<Exclude<NavAvoidanceQuality, 'none'>, AvoidanceParams> = {
    low: { divisions: 5, rings: 2, depth: 1 },
    medium: { divisions: 7, rings: 2, depth: 2 },
    high: { divisions: 7, rings: 3, depth: 4 },
};
const MAX_CIRCLES = 8;
const CIRCLE_FLOATS = 12;
const CIRCLE_X = 0;
const CIRCLE_Z = 1;
const CIRCLE_RADIUS = 2;
const CIRCLE_VELOCITY_X = 3;
const CIRCLE_VELOCITY_Z = 4;
const CIRCLE_DESIRED_X = 5;
const CIRCLE_DESIRED_Z = 6;
const CIRCLE_TOWARD_X = 7;
const CIRCLE_TOWARD_Z = 8;
const CIRCLE_SIDE_X = 9;
const CIRCLE_SIDE_Z = 10;
const CIRCLE_DISTANCE = 11;
const WEIGHT_DESIRED = 2;
const WEIGHT_CURRENT = 0.75;
const WEIGHT_SIDE = 0.75;
const WEIGHT_IMPACT = 2.5;
const HORIZON_SECONDS = 2.5;
const DESIRED_BIAS = 0.4;
const IMPACT_SOFTENING = 0.1;
const SIDE_THRESHOLD = 0.01;
const SPEED_SLACK = 1e-3;
const STATIONARY = 1e-6;
const FULL_TURN = Math.PI * 2;
export class AvoidanceQuery {
    private readonly circles = new Float32Array(MAX_CIRCLES * CIRCLE_FLOATS);
    private count = 0;
    get isEmpty(): boolean {
        return this.count === 0;
    }
    reset(): void {
        this.count = 0;
    }
    addCircle(distance: number, x: number, z: number, radius: number, velocity: Vec3, desiredVelocity: Vec3): void {
        const { circles } = this;
        const isFull = this.count === MAX_CIRCLES;
        const slot = isFull ? this.farthestSlot() : this.count;
        const offset = slot * CIRCLE_FLOATS;
        if (isFull && distance >= circles[offset + CIRCLE_DISTANCE])
            return;
        if (!isFull)
            this.count++;
        circles[offset + CIRCLE_X] = x;
        circles[offset + CIRCLE_Z] = z;
        circles[offset + CIRCLE_RADIUS] = radius;
        circles[offset + CIRCLE_VELOCITY_X] = velocity[0];
        circles[offset + CIRCLE_VELOCITY_Z] = velocity[2];
        circles[offset + CIRCLE_DESIRED_X] = desiredVelocity[0];
        circles[offset + CIRCLE_DESIRED_Z] = desiredVelocity[2];
        circles[offset + CIRCLE_DISTANCE] = distance;
    }
    sample(out: Vec3, position: Vec3, velocity: Vec3, desiredVelocity: Vec3, radius: number, maxSpeed: number, params: AvoidanceParams): void {
        this.orient(position, desiredVelocity);
        const baseAngle = Math.atan2(desiredVelocity[2], desiredVelocity[0]);
        const sector = FULL_TURN / params.divisions;
        const speedLimit = (maxSpeed + SPEED_SLACK) * (maxSpeed + SPEED_SLACK);
        let centerX = desiredVelocity[0] * DESIRED_BIAS;
        let centerZ = desiredVelocity[2] * DESIRED_BIAS;
        let spread = maxSpeed * (1 - DESIRED_BIAS);
        for (let pass = 0; pass < params.depth; pass++) {
            let chosenX = centerX;
            let chosenZ = centerZ;
            let lowest = this.penalty(centerX, centerZ, position, velocity, desiredVelocity, radius, maxSpeed);
            for (let ring = 0; ring < params.rings; ring++) {
                const reach = (spread * (params.rings - ring)) / params.rings;
                const firstAngle = baseAngle + (ring % 2) * sector * 0.5;
                for (let division = 0; division < params.divisions; division++) {
                    const candidateX = centerX + Math.cos(firstAngle + division * sector) * reach;
                    const candidateZ = centerZ + Math.sin(firstAngle + division * sector) * reach;
                    if (candidateX * candidateX + candidateZ * candidateZ > speedLimit)
                        continue;
                    const penalty = this.penalty(candidateX, candidateZ, position, velocity, desiredVelocity, radius, maxSpeed);
                    if (penalty < lowest) {
                        lowest = penalty;
                        chosenX = candidateX;
                        chosenZ = candidateZ;
                    }
                }
            }
            centerX = chosenX;
            centerZ = chosenZ;
            spread *= 0.5;
        }
        out[0] = centerX;
        out[1] = 0;
        out[2] = centerZ;
    }
    private farthestSlot(): number {
        let farthest = 0;
        for (let slot = 1; slot < this.count; slot++) {
            if (this.circles[slot * CIRCLE_FLOATS + CIRCLE_DISTANCE] > this.circles[farthest * CIRCLE_FLOATS + CIRCLE_DISTANCE])
                farthest = slot;
        }
        return farthest;
    }
    private orient(position: Vec3, desiredVelocity: Vec3): void {
        const { circles } = this;
        for (let offset = 0; offset < this.count * CIRCLE_FLOATS; offset += CIRCLE_FLOATS) {
            const offsetX = circles[offset + CIRCLE_X] - position[0];
            const offsetZ = circles[offset + CIRCLE_Z] - position[2];
            const distance = Math.hypot(offsetX, offsetZ) || 1;
            const towardX = offsetX / distance;
            const towardZ = offsetZ / distance;
            const relativeX = circles[offset + CIRCLE_DESIRED_X] - desiredVelocity[0];
            const relativeZ = circles[offset + CIRCLE_DESIRED_Z] - desiredVelocity[2];
            const passesLeft = relativeX * towardZ - towardX * relativeZ < SIDE_THRESHOLD;
            circles[offset + CIRCLE_TOWARD_X] = towardX;
            circles[offset + CIRCLE_TOWARD_Z] = towardZ;
            circles[offset + CIRCLE_SIDE_X] = passesLeft ? -towardZ : towardZ;
            circles[offset + CIRCLE_SIDE_Z] = passesLeft ? towardX : -towardX;
        }
    }
    private penalty(candidateX: number, candidateZ: number, position: Vec3, velocity: Vec3, desiredVelocity: Vec3, radius: number, maxSpeed: number): number {
        const { circles } = this;
        let earliestImpact = HORIZON_SECONDS;
        let sideBias = 0;
        for (let offset = 0; offset < this.count * CIRCLE_FLOATS; offset += CIRCLE_FLOATS) {
            const relativeX = candidateX * 2 - velocity[0] - circles[offset + CIRCLE_VELOCITY_X];
            const relativeZ = candidateZ * 2 - velocity[2] - circles[offset + CIRCLE_VELOCITY_Z];
            const toward = circles[offset + CIRCLE_TOWARD_X] * relativeX + circles[offset + CIRCLE_TOWARD_Z] * relativeZ;
            const sideways = circles[offset + CIRCLE_SIDE_X] * relativeX + circles[offset + CIRCLE_SIDE_Z] * relativeZ;
            sideBias += clamp(Math.min(toward * 0.5 + 0.5, sideways * 2), 0, 1);
            const separationX = circles[offset + CIRCLE_X] - position[0];
            const separationZ = circles[offset + CIRCLE_Z] - position[2];
            const reach = radius + circles[offset + CIRCLE_RADIUS];
            const speedSquared = relativeX * relativeX + relativeZ * relativeZ;
            if (speedSquared < STATIONARY)
                continue;
            const closing = relativeX * separationX + relativeZ * separationZ;
            const discriminant = closing * closing - speedSquared * (separationX * separationX + separationZ * separationZ - reach * reach);
            if (discriminant < 0)
                continue;
            const root = Math.sqrt(discriminant);
            const exit = (closing + root) / speedSquared;
            let entry = (closing - root) / speedSquared;
            if (entry < 0 && exit > 0)
                entry = -entry * 0.5;
            if (entry >= 0 && entry < earliestImpact)
                earliestImpact = entry;
        }
        const desiredPenalty = WEIGHT_DESIRED * Math.hypot(candidateX - desiredVelocity[0], candidateZ - desiredVelocity[2]) / maxSpeed;
        const currentPenalty = WEIGHT_CURRENT * Math.hypot(candidateX - velocity[0], candidateZ - velocity[2]) / maxSpeed;
        const sidePenalty = WEIGHT_SIDE * sideBias / this.count;
        const impactPenalty = WEIGHT_IMPACT / (IMPACT_SOFTENING + earliestImpact / HORIZON_SECONDS);
        return desiredPenalty + currentPenalty + sidePenalty + impactPenalty;
    }
}
