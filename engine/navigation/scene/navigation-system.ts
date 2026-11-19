import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { NavAgent } from '../agent/nav-agent';
import type { NavAgentSettings } from '../agent/nav-agent-settings';
import { areaCostTable } from '../areas/nav-areas';
import type { NavLinkSource } from '../mesh/nav-link';
import type { NavMesh } from '../mesh/nav-mesh';
import type { NavObstacleSettings } from '../obstacle/nav-obstacle-settings';
import { createNavSurfaceSettings } from '../surface/nav-surface-settings';
import { NavObstacle } from '../world/nav-obstacle';
import { NavigationWorld } from '../world/navigation-world';
import { bakeSurface, type NavSurfaceReport } from './bake-surface';
import { createLinkSource, readAgentPose, readObstaclePose, writeAgentPose } from './navigation-poses';
const TARGET_REPATH_DISTANCE = 0.5;
const SAME_ENDPOINT = 1e-3;
const targetPosition = vec3.create();
function isSameLink(first: NavLinkSource, second: NavLinkSource): boolean {
    return first.id === second.id && first.bidirectional === second.bidirectional && first.costOverride === second.costOverride && first.area === second.area
        && vec3.distance(first.start, second.start) < SAME_ENDPOINT && vec3.distance(first.end, second.end) < SAME_ENDPOINT;
}
export class NavigationSystem {
    readonly world = new NavigationWorld();
    reports: readonly NavSurfaceReport[] = [];
    onArrived: ((entity: Entity) => void) | null = null;
    private readonly agents = new Map<Entity, NavAgent>();
    private readonly obstacles = new Map<Entity, NavObstacle>();
    private links: NavLinkSource[] = [];
    constructor(private readonly scene: Scene) {
        this.world.onArrived = (agent) => {
            const entity = scene.findById(agent.id);
            if (entity)
                this.onArrived?.(entity);
        };
    }
    static isUsedBy(scene: Scene): boolean {
        return scene.entities.some((entity) => entity.navSurface !== null || entity.navAgent !== null);
    }
    build(): void {
        const { scene } = this;
        const reports: NavSurfaceReport[] = [];
        scene.updateWorldMatrices();
        this.world.areaCosts = areaCostTable(scene.navigation);
        for (const entity of scene.entities) {
            if (entity.navSurface)
                reports.push(bakeSurface(scene, entity, entity.navSurface));
        }
        if (reports.length === 0)
            reports.push(bakeSurface(scene, null, createNavSurfaceSettings()));
        const meshes: NavMesh[] = [];
        for (const report of reports) {
            if (report.mesh)
                meshes.push(report.mesh);
        }
        this.reports = reports;
        this.world.setMeshes(meshes);
    }
    update(deltaSeconds: number): void {
        this.scene.updateWorldMatrices();
        this.syncAgents();
        this.syncObstacles(deltaSeconds);
        this.syncLinks();
        this.followTargets();
        this.world.step(deltaSeconds);
        for (const [entity, agent] of this.agents) {
            if (agent.isOnNavMesh || agent.isOnLink)
                writeAgentPose(entity, agent);
        }
    }
    agentOf(entity: Entity): NavAgent | null {
        return this.agents.get(entity) ?? null;
    }
    ensureAgent(entity: Entity): NavAgent | null {
        const settings = entity.navAgent;
        const existing = this.agents.get(entity);
        if (existing || !settings || !this.isInScene(entity))
            return existing ?? null;
        return this.createAgent(entity, settings);
    }
    private isInScene(entity: Entity): boolean {
        return this.scene.findById(entity.id) === entity;
    }
    private syncAgents(): void {
        for (const [entity, agent] of this.agents) {
            if (entity.navAgent && this.isInScene(entity))
                continue;
            this.world.removeAgent(agent);
            this.agents.delete(entity);
        }
        for (const entity of this.scene.entities) {
            if (!entity.navAgent)
                continue;
            const agent = this.agents.get(entity) ?? this.createAgent(entity, entity.navAgent);
            agent.settings = entity.navAgent;
        }
    }
    private createAgent(entity: Entity, settings: NavAgentSettings): NavAgent {
        const agent = new NavAgent(entity.id, settings);
        readAgentPose(agent, entity);
        this.world.addAgent(agent);
        this.agents.set(entity, agent);
        return agent;
    }
    private syncObstacles(deltaSeconds: number): void {
        for (const [entity, obstacle] of this.obstacles) {
            if (entity.navObstacle && this.isInScene(entity))
                continue;
            this.world.removeObstacle(obstacle);
            this.obstacles.delete(entity);
        }
        for (const entity of this.scene.entities) {
            if (!entity.navObstacle)
                continue;
            const obstacle = this.obstacles.get(entity);
            if (obstacle)
                readObstaclePose(obstacle, entity, entity.navObstacle, deltaSeconds);
            else
                this.createObstacle(entity, entity.navObstacle);
        }
    }
    private createObstacle(entity: Entity, settings: NavObstacleSettings): void {
        const obstacle = new NavObstacle(entity.id);
        readObstaclePose(obstacle, entity, settings, 0);
        obstacle.isReshaped = false;
        this.world.addObstacle(obstacle);
        this.obstacles.set(entity, obstacle);
    }
    private syncLinks(): void {
        const links: NavLinkSource[] = [];
        for (const entity of this.scene.entities) {
            if (entity.navLink?.enabled)
                links.push(createLinkSource(entity, entity.navLink));
        }
        const isUnchanged = links.length === this.links.length && links.every((link, index) => isSameLink(link, this.links[index]));
        if (isUnchanged)
            return;
        this.links = links;
        this.world.setLinks(links);
    }
    private followTargets(): void {
        for (const [entity, agent] of this.agents) {
            const targetId = agent.settings.target;
            const target = targetId === null ? null : this.scene.findById(targetId);
            if (!target || target === entity)
                continue;
            mat4.getTranslation(targetPosition, target.worldMatrix);
            if (!agent.hasDestination || vec3.distance(agent.destination, targetPosition) > TARGET_REPATH_DISTANCE)
                agent.setDestination(targetPosition);
        }
    }
}
