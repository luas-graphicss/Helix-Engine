import * as mat4 from '@/engine/core/math/mat4';
import { DEG_TO_RAD, RAD_TO_DEG } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { NavAgent } from '../agent/nav-agent';
import type { NavLinkSettings } from '../link/nav-link-settings';
import type { NavLinkSource } from '../mesh/nav-link';
import type { NavObstacleSettings } from '../obstacle/nav-obstacle-settings';
import type { NavObstacle } from '../world/nav-obstacle';
const SAME_SIZE = 1e-4;
const worldPosition = vec3.create();
const previousPosition = vec3.create();
const parentInverse = mat4.create();
function axisScale(entity: Entity, axis: number): number {
    const world = entity.worldMatrix;
    return Math.hypot(world[axis * 4], world[axis * 4 + 1], world[axis * 4 + 2]);
}
export function readAgentPose(agent: NavAgent, entity: Entity): void {
    mat4.getTranslation(agent.position, entity.worldMatrix);
    agent.position[1] -= agent.settings.baseOffset;
    agent.heading = entity.transform.rotation[1] * DEG_TO_RAD;
}
export function writeAgentPose(entity: Entity, agent: NavAgent): void {
    const { parent, transform } = entity;
    vec3.set(worldPosition, agent.position[0], agent.position[1] + agent.settings.baseOffset, agent.position[2]);
    if (parent && mat4.invert(parentInverse, parent.worldMatrix))
        mat4.transformPoint(transform.position, parentInverse, worldPosition);
    else
        vec3.copy(transform.position, worldPosition);
    transform.rotation[1] = agent.heading * RAD_TO_DEG;
}
export function readObstaclePose(obstacle: NavObstacle, entity: Entity, settings: NavObstacleSettings, deltaSeconds: number): void {
    const world = entity.worldMatrix;
    const scaleX = axisScale(entity, 0);
    const scaleZ = axisScale(entity, 2);
    const isCapsule = settings.shape === 'capsule';
    const halfWidth = (settings.size[0] / 2) * (isCapsule ? Math.max(scaleX, scaleZ) : scaleX);
    const halfHeight = (settings.size[1] / 2) * axisScale(entity, 1);
    const halfDepth = isCapsule ? halfWidth : (settings.size[2] / 2) * scaleZ;
    const isReshaped = obstacle.shape !== settings.shape || Math.abs(obstacle.halfWidth - halfWidth) > SAME_SIZE
        || Math.abs(obstacle.halfHeight - halfHeight) > SAME_SIZE || Math.abs(obstacle.halfDepth - halfDepth) > SAME_SIZE;
    vec3.copy(previousPosition, obstacle.position);
    mat4.transformPoint(obstacle.position, world, settings.center);
    if (deltaSeconds > 0)
        vec3.scale(obstacle.velocity, vec3.subtract(obstacle.velocity, obstacle.position, previousPosition), 1 / deltaSeconds);
    obstacle.heading = Math.atan2(-world[2], world[0]);
    obstacle.shape = settings.shape;
    obstacle.halfWidth = halfWidth;
    obstacle.halfHeight = halfHeight;
    obstacle.halfDepth = halfDepth;
    obstacle.carve = settings.carve;
    obstacle.carveOnlyStationary = settings.carveOnlyStationary;
    obstacle.moveThreshold = settings.moveThreshold;
    obstacle.timeToStationary = settings.timeToStationary;
    obstacle.isReshaped ||= isReshaped;
}
export function createLinkSource(entity: Entity, settings: NavLinkSettings): NavLinkSource {
    return {
        id: entity.id,
        start: mat4.transformPoint(vec3.create(), entity.worldMatrix, settings.start),
        end: mat4.transformPoint(vec3.create(), entity.worldMatrix, settings.end),
        bidirectional: settings.bidirectional,
        costOverride: settings.costOverride,
        area: settings.area,
    };
}
