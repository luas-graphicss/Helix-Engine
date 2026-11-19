import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { NavPath } from '../path/nav-path';
import type { NavAgent } from './nav-agent';
const MIN_CORNER_REACH = 0.1;
const ARRIVAL_DISTANCE = 0.05;
const LINK_ARC_PER_METER = 0.2;
const MIN_LINK_SECONDS = 0.1;
const MIN_LINK_SPEED = 0.5;
const AT_CORNER = 1e-6;
function flatDistance(from: Vec3, to: Vec3): number {
    return Math.hypot(to[0] - from[0], to[2] - from[2]);
}
function beginTraversal(agent: NavAgent, from: Vec3, to: Vec3): void {
    const distance = vec3.distance(from, to);
    const speed = Math.max(agent.settings.speed, MIN_LINK_SPEED);
    agent.traversal = { from, to, duration: Math.max(MIN_LINK_SECONDS, distance / speed), arcHeight: distance * LINK_ARC_PER_METER, elapsed: 0 };
}
function advanceCorners(agent: NavAgent, path: NavPath, reach: number): void {
    const lastCorner = path.corners.length - 1;
    while (agent.cornerIndex < lastCorner && flatDistance(agent.position, path.corners[agent.cornerIndex]) <= reach) {
        if (path.links[agent.cornerIndex]) {
            beginTraversal(agent, path.corners[agent.cornerIndex], path.corners[agent.cornerIndex + 1]);
            agent.cornerIndex += 2;
            return;
        }
        agent.cornerIndex++;
    }
}
export function steerAgent(agent: NavAgent, deltaSeconds: number): void {
    const { path, settings, desiredVelocity } = agent;
    vec3.set(desiredVelocity, 0, 0, 0);
    if (!path || agent.isStopped || agent.hasArrived || agent.traversal)
        return;
    advanceCorners(agent, path, Math.max(MIN_CORNER_REACH, settings.speed * deltaSeconds));
    if (agent.traversal)
        return;
    const remaining = agent.remainingDistance;
    if (agent.cornerIndex >= path.corners.length || remaining <= Math.max(settings.stoppingDistance, ARRIVAL_DISTANCE)) {
        agent.hasArrived = true;
        return;
    }
    const corner = path.corners[agent.cornerIndex];
    const offsetX = corner[0] - agent.position[0];
    const offsetZ = corner[2] - agent.position[2];
    const distance = Math.hypot(offsetX, offsetZ);
    if (distance < AT_CORNER)
        return;
    const brakingSpeed = Math.sqrt(2 * settings.acceleration * Math.max(0, remaining - settings.stoppingDistance));
    const speed = settings.autoBraking ? Math.min(settings.speed, brakingSpeed) : settings.speed;
    desiredVelocity[0] = (offsetX / distance) * speed;
    desiredVelocity[2] = (offsetZ / distance) * speed;
}
