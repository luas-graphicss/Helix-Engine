import * as mat4 from '@/engine/core/math/mat4';
import { createSkySettings, type SkySettings } from '@/engine/core/environment/sky-settings';
import { createPhysicsSettings, type PhysicsSettings } from '@/engine/physics/world/physics-settings';
import { createPlayerSettings, type PlayerSettings } from '@/engine/character/player-settings';
import { Entity, type EntityOptions } from './entity';
export class Scene {
    readonly root: Entity;
    readonly sky: SkySettings;
    readonly physics: PhysicsSettings;
    readonly player: PlayerSettings;
    private nextId = 1;
    constructor(rootName = 'Cena', sky: SkySettings = createSkySettings(), physics: PhysicsSettings = createPhysicsSettings(), player: PlayerSettings = createPlayerSettings()) {
        this.root = new Entity({ id: this.nextId++, name: rootName, kind: 'group' });
        this.sky = sky;
        this.physics = physics;
        this.player = player;
    }
    findSunLight(): Entity | null {
        let found: Entity | null = null;
        this.traverseVisible((entity) => {
            if (!found && entity.light?.type === 'directional')
                found = entity;
        });
        return found;
    }
    createEntity(options: Omit<EntityOptions, 'id'>, parent: Entity | null = this.root): Entity {
        const entity = new Entity({ ...options, id: this.nextId++ });
        parent?.add(entity);
        return entity;
    }
    traverse(visitor: (entity: Entity) => void, from: Entity = this.root): void {
        visitor(from);
        for (const child of from.children) {
            this.traverse(visitor, child);
        }
    }
    traverseVisible(visitor: (entity: Entity) => void, from: Entity = this.root): void {
        if (!from.visible)
            return;
        visitor(from);
        for (const child of from.children) {
            this.traverseVisible(visitor, child);
        }
    }
    updateWorldMatrices(): void {
        this.propagateWorldMatrix(this.root, false);
    }
    private propagateWorldMatrix(entity: Entity, parentChanged: boolean): void {
        const localChanged = entity.transform.updateLocalMatrix();
        const changed = localChanged || parentChanged || entity.worldMatrixStale;
        if (changed) {
            if (entity.parent) {
                mat4.multiply(entity.worldMatrix, entity.parent.worldMatrix, entity.transform.localMatrix);
            }
            else {
                mat4.copy(entity.worldMatrix, entity.transform.localMatrix);
            }
            entity.worldMatrixStale = false;
        }
        const { children } = entity;
        for (let i = 0; i < children.length; i++)
            this.propagateWorldMatrix(children[i], changed);
    }
}
