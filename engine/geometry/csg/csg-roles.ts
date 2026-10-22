import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
export function canBeCsgTarget(entity: Entity): boolean {
    return entity.kind === 'mesh' && entity.mesh !== null && !entity.skin && entity.terrain === null;
}
export function canBeCsgBrush(entity: Entity): boolean {
    return canBeCsgTarget(entity) && entity.parent !== null;
}
export function brushesOf(target: Entity): Entity[] {
    return target.children.filter((child) => child.csgBrush !== null);
}
export function listCsgTargets(scene: Scene): Entity[] {
    const targets: Entity[] = [];
    scene.traverse((entity) => {
        if (entity.csg)
            targets.push(entity);
    });
    return targets;
}
