import * as mat4 from '@/engine/core/math/mat4';
import { createSkySettings, type SkySettings } from '@/engine/core/environment/sky-settings';
import { createPostProcessSettings, type PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { createPhysicsSettings, type PhysicsSettings } from '@/engine/physics/world/physics-settings';
import { createPlayerSettings, type PlayerSettings } from '@/engine/character/player-settings';
import { createMixerSettings, type MixerSettings } from '@/engine/audio/mixer/mixer-settings';
import { createScriptingSettings, type ScriptingSettings } from '@/engine/scripting/scripting-settings';
import { Entity, entityTreeGeneration, type EntityOptions } from './entity';
export class Scene {
    readonly root: Entity;
    readonly sky: SkySettings;
    readonly postProcessing: PostProcessSettings;
    readonly physics: PhysicsSettings;
    readonly player: PlayerSettings;
    readonly audio: MixerSettings;
    readonly scripting: ScriptingSettings;
    private nextId = 1;
    constructor(rootName = 'Cena', sky: SkySettings = createSkySettings(), physics: PhysicsSettings = createPhysicsSettings(), player: PlayerSettings = createPlayerSettings(), postProcessing: PostProcessSettings = createPostProcessSettings(), audio: MixerSettings = createMixerSettings(), scripting: ScriptingSettings = createScriptingSettings()) {
        this.root = new Entity({ id: this.nextId++, name: rootName, kind: 'group' });
        this.sky = sky;
        this.postProcessing = postProcessing;
        this.physics = physics;
        this.player = player;
        this.audio = audio;
        this.scripting = scripting;
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
    restoreEntity(options: EntityOptions, parent: Entity | null): Entity {
        const entity = new Entity(options);
        this.nextId = Math.max(this.nextId, options.id + 1);
        parent?.add(entity);
        return entity;
    }
    get nextEntityId(): number {
        return this.nextId;
    }
    reserveEntityIds(nextId: number): void {
        this.nextId = Math.max(this.nextId, nextId);
    }
    traverse(visitor: (entity: Entity) => void, from: Entity = this.root): void {
        visitor(from);
        for (const child of from.children) {
            this.traverse(visitor, child);
        }
    }
    findById(id: number): Entity | null {
        return this.index().get(id) ?? null;
    }
    traversalOrder(entity: Entity): number {
        return this.index().get(entity.id) === entity ? (this.indexOrder.get(entity.id) ?? -1) : -1;
    }
    get entityCount(): number {
        return this.index().size - 1;
    }
    get entities(): readonly Entity[] {
        this.index();
        return this.indexFlat;
    }
    private indexById = new Map<number, Entity>();
    private indexOrder = new Map<number, number>();
    private indexFlat: readonly Entity[] = [];
    private indexParent: Int32Array = new Int32Array(0);
    private visibleFlags: Uint8Array = new Uint8Array(0);
    private indexGeneration = -1;
    private index(): ReadonlyMap<number, Entity> {
        const generation = entityTreeGeneration();
        if (generation !== this.indexGeneration) {
            const byId = this.indexById;
            const order = this.indexOrder;
            const flat: Entity[] = [];
            const parents: number[] = [];
            byId.clear();
            order.clear();
            this.traverse((entity) => {
                byId.set(entity.id, entity);
                order.set(entity.id, flat.length);
                parents.push(entity.parent ? (order.get(entity.parent.id) ?? -1) : -1);
                flat.push(entity);
            });
            this.indexFlat = flat;
            this.indexParent = Int32Array.from(parents);
            if (this.visibleFlags.length < flat.length)
                this.visibleFlags = new Uint8Array(flat.length);
            this.indexGeneration = generation;
        }
        return this.indexById;
    }
    traverseVisible(visitor: (entity: Entity) => void, from: Entity = this.root): void {
        if (from !== this.root) {
            this.traverseVisibleFrom(visitor, from);
            return;
        }
        const entities = this.entities;
        const parents = this.indexParent;
        const flags = this.visibleFlags;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const parent = parents[i];
            const visible = entity.visible && (parent < 0 || flags[parent] === 1);
            flags[i] = visible ? 1 : 0;
            if (visible)
                visitor(entity);
        }
    }
    private traverseVisibleFrom(visitor: (entity: Entity) => void, from: Entity): void {
        if (!from.visible)
            return;
        visitor(from);
        for (const child of from.children)
            this.traverseVisibleFrom(visitor, child);
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
