import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { createClosedHouse, createOpenShelter, createShopArcade, createAlley } from './buildings';
import { createClearanceSlabs, createOverpass } from './clearances';
import { createBoulders } from './boulders';
export function createOcclusionProps(scene: Scene, parent: Entity): void {
    createClosedHouse(scene, parent);
    createOpenShelter(scene, parent);
    createShopArcade(scene, parent);
    createAlley(scene, parent);
    createOverpass(scene, parent);
    createClearanceSlabs(scene, parent);
    createBoulders(scene, parent);
}
