import { clamp, DEG_TO_RAD } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { NavMesh } from '../mesh/nav-mesh';
import { moveOnMesh } from '../mesh/nav-mesh-movement';
import { sampleHeight } from '../mesh/nav-mesh-queries';
import type { LinkTraversal, NavAgent } from './nav-agent';
const MIN_TURN_SPEED = 0.05;
const FULL_TURN = Math.PI * 2;
const ARC_PEAK = 4;
const moved = vec3.create();
function turnToward(agent: NavAgent, directionX: number, directionZ: number, deltaSeconds: number): void {
    const target = Math.atan2(directionX, directionZ);
    const difference = target - agent.heading;
    const shortest = difference - Math.round(difference / FULL_TURN) * FULL_TURN;
    const step = agent.settings.angularSpeed * DEG_TO_RAD * deltaSeconds;
    agent.heading += clamp(shortest, -step, step);
}
export function nudgeAgent(agent: NavAgent, mesh: NavMesh, offsetX: number, offsetZ: number): void {
    const { position } = agent;
    agent.cell = moveOnMesh(moved, mesh, agent.cell, position[0] + offsetX, position[2] + offsetZ);
    position[0] = moved[0];
    position[2] = moved[2];
    position[1] = sampleHeight(mesh, agent.cell, moved[0], moved[2]);
}
export function moveAgent(agent: NavAgent, mesh: NavMesh, deltaSeconds: number): void {
    const { velocity, plannedVelocity, position, settings } = agent;
    const changeX = plannedVelocity[0] - velocity[0];
    const changeZ = plannedVelocity[2] - velocity[2];
    const change = Math.hypot(changeX, changeZ);
    const limit = settings.acceleration * deltaSeconds;
    const applied = change > limit ? limit / change : 1;
    const startX = position[0];
    const startZ = position[2];
    nudgeAgent(agent, mesh, (velocity[0] + changeX * applied) * deltaSeconds, (velocity[2] + changeZ * applied) * deltaSeconds);
    velocity[0] = (position[0] - startX) / deltaSeconds;
    velocity[2] = (position[2] - startZ) / deltaSeconds;
    if (Math.hypot(velocity[0], velocity[2]) > MIN_TURN_SPEED)
        turnToward(agent, velocity[0], velocity[2], deltaSeconds);
}
export function advanceTraversal(agent: NavAgent, traversal: LinkTraversal, deltaSeconds: number): boolean {
    const { from, to } = traversal;
    traversal.elapsed += deltaSeconds;
    const progress = Math.min(1, traversal.elapsed / traversal.duration);
    for (let axis = 0; axis < 3; axis++) {
        agent.position[axis] = from[axis] + (to[axis] - from[axis]) * progress;
        agent.velocity[axis] = (to[axis] - from[axis]) / traversal.duration;
    }
    agent.position[1] += traversal.arcHeight * ARC_PEAK * progress * (1 - progress);
    if (Math.hypot(to[0] - from[0], to[2] - from[2]) > MIN_TURN_SPEED)
        turnToward(agent, to[0] - from[0], to[2] - from[2], deltaSeconds);
    return progress >= 1;
}
