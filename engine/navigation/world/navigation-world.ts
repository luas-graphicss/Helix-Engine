import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { advanceTraversal, moveAgent, nudgeAgent } from '../agent/agent-motion';
import { steerAgent } from '../agent/agent-steering';
import { AVOIDANCE_PARAMS, AvoidanceQuery } from '../agent/avoidance';
import type { NavAgent } from '../agent/nav-agent';
import { areaCostTable, createNavigationSettings } from '../areas/nav-areas';
import { NO_CELL } from '../mesh/nav-cells';
import type { NavLinkSource } from '../mesh/nav-link';
import type { NavMesh } from '../mesh/nav-mesh';
import { attachLinks } from '../mesh/nav-mesh-links';
import { clampToCell, findNearestCell } from '../mesh/nav-mesh-queries';
import { CorridorSearch } from '../path/corridor-search';
import { findPath } from '../path/find-path';
import { INVALID_PATH, type NavPath } from '../path/nav-path';
import { stampObstacles } from './carve-obstacles';
import type { NavObstacle } from './nav-obstacle';
const MAX_STEP_SECONDS = 1 / 30;
const MIN_SNAP_DISTANCE = 2;
const SNAP_PER_AGENT_HEIGHT = 2;
const NEIGHBOR_RANGE_RADII = 12;
const SEPARATION_STRENGTH = 0.5;
const MIN_AVOIDANCE_SPEED = 0.01;
const COINCIDENT = 1e-5;
const snapped = vec3.create();
interface MeshLocation {
    mesh: NavMesh | null;
    cell: number;
}
const located: MeshLocation = { mesh: null, cell: NO_CELL };
function snapDistance(mesh: NavMesh): number {
    return Math.max(MIN_SNAP_DISTANCE, mesh.shape.agentHeight * SNAP_PER_AGENT_HEIGHT);
}
function flatDistance(from: Vec3, to: Vec3): number {
    return Math.hypot(to[0] - from[0], to[2] - from[2]);
}
export class NavigationWorld {
    readonly agents: NavAgent[] = [];
    readonly obstacles: NavObstacle[] = [];
    areaCosts: Float32Array = areaCostTable(createNavigationSettings());
    onArrived: ((agent: NavAgent) => void) | null = null;
    private meshList: NavMesh[] = [];
    private linkSources: readonly NavLinkSource[] = [];
    private readonly search = new CorridorSearch();
    private readonly avoidance = new AvoidanceQuery();
    get meshes(): readonly NavMesh[] {
        return this.meshList;
    }
    setMeshes(meshes: NavMesh[]): void {
        this.meshList = meshes;
        for (const agent of this.agents) {
            agent.mesh = null;
            agent.cell = NO_CELL;
        }
        this.refreshMeshes();
    }
    setLinks(sources: readonly NavLinkSource[]): void {
        this.linkSources = sources;
        for (const mesh of this.meshList)
            attachLinks(mesh, sources, snapDistance(mesh));
        this.invalidatePaths();
    }
    addAgent(agent: NavAgent): void {
        this.agents.push(agent);
    }
    addObstacle(obstacle: NavObstacle): void {
        obstacle.settle();
        this.obstacles.push(obstacle);
    }
    removeAgent(agent: NavAgent): void {
        const index = this.agents.indexOf(agent);
        if (index !== -1)
            this.agents.splice(index, 1);
    }
    removeObstacle(obstacle: NavObstacle): void {
        const index = this.obstacles.indexOf(obstacle);
        if (index === -1)
            return;
        this.obstacles.splice(index, 1);
        if (obstacle.isCarving)
            this.refreshMeshes();
    }
    warp(agent: NavAgent, point: Vec3): boolean {
        if (!this.locate(point))
            return false;
        this.place(agent);
        agent.resetPath();
        vec3.set(agent.velocity, 0, 0, 0);
        return true;
    }
    findPath(start: Vec3, end: Vec3, areaMask: number): NavPath {
        if (!this.locate(start) || !located.mesh)
            return INVALID_PATH;
        return findPath(located.mesh, this.search, start, end, { areaMask, areaCosts: this.areaCosts }, snapDistance(located.mesh));
    }
    samplePosition(out: Vec3, point: Vec3, maxDistance: number): boolean {
        if (!this.locate(point, maxDistance) || !located.mesh)
            return false;
        clampToCell(out, located.mesh, located.cell, point);
        return true;
    }
    step(deltaSeconds: number): void {
        const steps = Math.max(1, Math.ceil(deltaSeconds / MAX_STEP_SECONDS));
        const stepSeconds = deltaSeconds / steps;
        for (let step = 0; step < steps; step++)
            this.advance(stepSeconds);
    }
    private advance(stepSeconds: number): void {
        this.updateCarving(stepSeconds);
        for (const agent of this.agents)
            this.prepare(agent);
        for (const agent of this.agents)
            this.steer(agent, stepSeconds);
        for (const agent of this.agents)
            this.planVelocity(agent);
        for (const agent of this.agents)
            this.integrate(agent, stepSeconds);
        for (let first = 0; first < this.agents.length; first++) {
            for (let second = first + 1; second < this.agents.length; second++)
                this.separate(this.agents[first], this.agents[second]);
        }
    }
    private updateCarving(stepSeconds: number): void {
        let hasFootprintChanged = false;
        for (const obstacle of this.obstacles)
            hasFootprintChanged = obstacle.update(stepSeconds) || hasFootprintChanged;
        if (hasFootprintChanged)
            this.refreshMeshes();
    }
    private refreshMeshes(): void {
        for (const mesh of this.meshList) {
            stampObstacles(mesh, this.obstacles);
            attachLinks(mesh, this.linkSources, snapDistance(mesh));
        }
        this.invalidatePaths();
    }
    private invalidatePaths(): void {
        for (const agent of this.agents) {
            if (agent.hasDestination && !agent.hasArrived)
                agent.needsPath = true;
        }
    }
    private locate(point: Vec3, maxDistance = Infinity): boolean {
        let closest = Infinity;
        located.mesh = null;
        located.cell = NO_CELL;
        for (const mesh of this.meshList) {
            const cell = findNearestCell(mesh, point[0], point[1], point[2], Math.min(maxDistance, snapDistance(mesh)));
            if (cell === NO_CELL)
                continue;
            const distance = vec3.distance(point, clampToCell(snapped, mesh, cell, point));
            if (distance < closest) {
                closest = distance;
                located.mesh = mesh;
                located.cell = cell;
            }
        }
        return located.mesh !== null;
    }
    private place(agent: NavAgent): void {
        if (!located.mesh)
            return;
        agent.mesh = located.mesh;
        agent.cell = located.cell;
        clampToCell(agent.position, located.mesh, located.cell, agent.position);
    }
    private prepare(agent: NavAgent): void {
        if (agent.traversal)
            return;
        if (!agent.isOnNavMesh && this.locate(agent.position))
            this.place(agent);
        const { mesh } = agent;
        if (!mesh || !agent.isOnNavMesh || !agent.needsPath || !agent.hasDestination)
            return;
        const path = findPath(mesh, this.search, agent.position, agent.destination, { areaMask: agent.settings.areaMask, areaCosts: this.areaCosts }, snapDistance(mesh));
        agent.path = path.status === 'invalid' ? null : path;
        agent.cornerIndex = 0;
        agent.needsPath = false;
        agent.hasArrived = false;
    }
    private steer(agent: NavAgent, stepSeconds: number): void {
        const hadArrived = agent.hasArrived;
        steerAgent(agent, stepSeconds);
        if (agent.hasArrived && !hadArrived)
            this.onArrived?.(agent);
    }
    private planVelocity(agent: NavAgent): void {
        const { settings, desiredVelocity } = agent;
        vec3.copy(agent.plannedVelocity, desiredVelocity);
        if (settings.avoidance === 'none' || agent.traversal || Math.hypot(desiredVelocity[0], desiredVelocity[2]) < MIN_AVOIDANCE_SPEED)
            return;
        this.collectNeighbors(agent);
        if (!this.avoidance.isEmpty)
            this.avoidance.sample(agent.plannedVelocity, agent.position, agent.velocity, desiredVelocity, settings.radius, settings.speed, AVOIDANCE_PARAMS[settings.avoidance]);
    }
    private collectNeighbors(agent: NavAgent): void {
        const { settings, position } = agent;
        const range = settings.radius * NEIGHBOR_RANGE_RADII;
        this.avoidance.reset();
        for (const other of this.agents) {
            if (other === agent || other.mesh !== agent.mesh || other.traversal || other.settings.avoidancePriority > settings.avoidancePriority)
                continue;
            const distance = flatDistance(position, other.position);
            if (distance <= range + other.settings.radius && Math.abs(other.position[1] - position[1]) <= settings.height)
                this.avoidance.addCircle(distance, other.position[0], other.position[2], other.settings.radius, other.velocity, other.desiredVelocity);
        }
        for (const obstacle of this.obstacles) {
            if (obstacle.isCarving)
                continue;
            const distance = flatDistance(position, obstacle.position);
            if (distance <= range + obstacle.boundingRadius && Math.abs(obstacle.position[1] - position[1]) <= settings.height + obstacle.halfHeight)
                this.avoidance.addCircle(distance, obstacle.position[0], obstacle.position[2], obstacle.boundingRadius, obstacle.velocity, obstacle.velocity);
        }
    }
    private integrate(agent: NavAgent, stepSeconds: number): void {
        const { traversal, mesh } = agent;
        if (traversal) {
            if (advanceTraversal(agent, traversal, stepSeconds))
                this.finishTraversal(agent, traversal.to);
            return;
        }
        if (mesh && agent.isOnNavMesh)
            moveAgent(agent, mesh, stepSeconds);
    }
    private finishTraversal(agent: NavAgent, landing: Vec3): void {
        agent.traversal = null;
        vec3.copy(agent.position, landing);
        agent.cell = agent.mesh ? findNearestCell(agent.mesh, landing[0], landing[1], landing[2], snapDistance(agent.mesh)) : NO_CELL;
    }
    private separate(first: NavAgent, second: NavAgent): void {
        const { mesh } = first;
        if (!mesh || second.mesh !== mesh || first.traversal || second.traversal || !first.isOnNavMesh || !second.isOnNavMesh)
            return;
        if (Math.abs(second.position[1] - first.position[1]) > Math.min(first.settings.height, second.settings.height))
            return;
        const offsetX = second.position[0] - first.position[0];
        const offsetZ = second.position[2] - first.position[2];
        const distance = Math.hypot(offsetX, offsetZ);
        const overlap = first.settings.radius + second.settings.radius - distance;
        if (overlap <= 0)
            return;
        const push = (overlap * SEPARATION_STRENGTH) / 2;
        const directionX = distance < COINCIDENT ? 1 : offsetX / distance;
        const directionZ = distance < COINCIDENT ? 0 : offsetZ / distance;
        nudgeAgent(first, mesh, -directionX * push, -directionZ * push);
        nudgeAgent(second, mesh, directionX * push, directionZ * push);
    }
}
