import * as mat4 from '@/engine/core/math/mat4';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { Transform } from './transform';
import type { Material } from './material';
import type { Light } from './light';
export type EntityKind = 'group' | 'mesh' | 'light' | 'camera' | 'terrain';
export interface EntityOptions {
    id: number;
    name: string;
    kind: EntityKind;
    mesh?: MeshData;
    material?: Material;
    light?: Light;
    terrain?: Terrain;
    rigidBody?: RigidBodySettings;
    castShadows?: boolean;
    receiveShadows?: boolean;
}
export class Entity {
    readonly id: number;
    name: string;
    readonly kind: EntityKind;
    readonly transform = new Transform();
    readonly worldMatrix = mat4.create();
    readonly children: Entity[] = [];
    parent: Entity | null = null;
    worldMatrixStale = true;
    visible = true;
    mesh: MeshData | null;
    material: Material | null;
    light: Light | null;
    terrain: Terrain | null;
    rigidBody: RigidBodySettings | null;
    castShadows: boolean;
    receiveShadows: boolean;
    constructor(options: EntityOptions) {
        this.id = options.id;
        this.name = options.name;
        this.kind = options.kind;
        this.mesh = options.mesh ?? null;
        this.material = options.material ?? null;
        this.light = options.light ?? null;
        this.terrain = options.terrain ?? null;
        this.rigidBody = options.rigidBody ?? null;
        this.castShadows = options.castShadows ?? true;
        this.receiveShadows = options.receiveShadows ?? true;
    }
    add(child: Entity): Entity {
        return this.insert(child, this.children.length);
    }
    insert(child: Entity, index: number): Entity {
        child.parent?.remove(child);
        child.parent = this;
        child.worldMatrixStale = true;
        const clamped = Math.max(0, Math.min(index, this.children.length));
        this.children.splice(clamped, 0, child);
        return child;
    }
    remove(child: Entity): void {
        const index = this.children.indexOf(child);
        if (index === -1)
            return;
        this.children.splice(index, 1);
        child.parent = null;
    }
    contains(other: Entity): boolean {
        let current: Entity | null = other;
        while (current) {
            if (current === this)
                return true;
            current = current.parent;
        }
        return false;
    }
}
