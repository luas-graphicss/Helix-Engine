import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { NO_CELL } from '../mesh/nav-cells';
import type { NavMesh } from '../mesh/nav-mesh';
import type { NavPath } from '../path/nav-path';
import type { NavAgentSettings } from './nav-agent-settings';
export interface LinkTraversal {
    readonly from: Vec3;
    readonly to: Vec3;
    readonly duration: number;
    readonly arcHeight: number;
    elapsed: number;
}
export class NavAgent {
    readonly position = vec3.create();
    readonly velocity = vec3.create();
    readonly desiredVelocity = vec3.create();
    readonly plannedVelocity = vec3.create();
    readonly destination = vec3.create();
    heading = 0;
    mesh: NavMesh | null = null;
    cell = NO_CELL;
    path: NavPath | null = null;
    cornerIndex = 0;
    traversal: LinkTraversal | null = null;
    hasDestination = false;
    needsPath = false;
    isStopped = false;
    hasArrived = false;
    constructor(readonly id: number, public settings: NavAgentSettings) { }
    get isOnNavMesh(): boolean {
        return this.mesh !== null && this.mesh.isWalkable(this.cell);
    }
    get isOnLink(): boolean {
        return this.traversal !== null;
    }
    get remainingDistance(): number {
        const { path } = this;
        if (!path || this.cornerIndex >= path.corners.length)
            return 0;
        let remaining = vec3.distance(this.position, path.corners[this.cornerIndex]);
        for (let index = this.cornerIndex + 1; index < path.corners.length; index++)
            remaining += vec3.distance(path.corners[index - 1], path.corners[index]);
        return remaining;
    }
    setDestination(point: Vec3): void {
        vec3.copy(this.destination, point);
        this.hasDestination = true;
        this.needsPath = true;
        this.hasArrived = false;
    }
    resetPath(): void {
        this.path = null;
        this.cornerIndex = 0;
        this.traversal = null;
        this.hasDestination = false;
        this.needsPath = false;
        this.hasArrived = false;
        vec3.set(this.desiredVelocity, 0, 0, 0);
    }
}
