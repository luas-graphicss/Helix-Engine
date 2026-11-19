import type { Scene } from '@/engine/core/scene/scene';
import type { NavMesh } from '../mesh/nav-mesh';
import { stampObstacles } from '../world/carve-obstacles';
import { NavObstacle } from '../world/nav-obstacle';
import { readObstaclePose } from './navigation-poses';
export function stampSceneObstacles(scene: Scene, mesh: NavMesh): void {
    const obstacles: NavObstacle[] = [];
    for (const entity of scene.entities) {
        const settings = entity.navObstacle;
        if (!settings?.carve || !entity.visible)
            continue;
        const obstacle = new NavObstacle(entity.id);
        readObstaclePose(obstacle, entity, settings, 0);
        obstacle.settle();
        obstacle.update(0);
        obstacles.push(obstacle);
    }
    stampObstacles(mesh, obstacles);
}
