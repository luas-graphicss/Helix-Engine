import * as vec3 from '@/engine/core/math/vec3';
import type { NavObstacleShape } from '../obstacle/nav-obstacle-settings';
const HEADING_THRESHOLD = 0.02;
export class NavObstacle {
    readonly position = vec3.create();
    readonly velocity = vec3.create();
    readonly carvedPosition = vec3.create();
    heading = 0;
    carvedHeading = 0;
    shape: NavObstacleShape = 'box';
    halfWidth = 0.5;
    halfHeight = 0.5;
    halfDepth = 0.5;
    carve = true;
    carveOnlyStationary = true;
    moveThreshold = 0.1;
    timeToStationary = 0.5;
    isCarving = false;
    isReshaped = false;
    private readonly anchor = vec3.create();
    private anchorHeading = 0;
    private stillSeconds = 0;
    constructor(readonly id: number) { }
    get boundingRadius(): number {
        return this.shape === 'capsule' ? this.halfWidth : Math.hypot(this.halfWidth, this.halfDepth);
    }
    settle(): void {
        vec3.copy(this.anchor, this.position);
        this.anchorHeading = this.heading;
        this.stillSeconds = Infinity;
    }
    update(deltaSeconds: number): boolean {
        if (!this.carve)
            return this.stopCarving();
        const hasMoved = vec3.distance(this.position, this.anchor) > this.moveThreshold || Math.abs(this.heading - this.anchorHeading) > HEADING_THRESHOLD;
        if (hasMoved) {
            vec3.copy(this.anchor, this.position);
            this.anchorHeading = this.heading;
        }
        this.stillSeconds = hasMoved ? 0 : this.stillSeconds + deltaSeconds;
        if (this.carveOnlyStationary && this.stillSeconds < this.timeToStationary)
            return this.stopCarving();
        if (this.isCarving && !hasMoved && !this.isReshaped)
            return false;
        this.isReshaped = false;
        return this.carveHere();
    }
    private stopCarving(): boolean {
        const wasCarving = this.isCarving;
        this.isCarving = false;
        return wasCarving;
    }
    private carveHere(): boolean {
        this.isCarving = true;
        vec3.copy(this.carvedPosition, this.position);
        this.carvedHeading = this.heading;
        return true;
    }
}
