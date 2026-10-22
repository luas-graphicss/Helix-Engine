import * as mat4 from '@/engine/core/math/mat4';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import type { Terrain } from '@/engine/terrain/core/terrain';
import type { CharacterSettings } from '@/engine/character/character-settings';
import type { CsgBrushSettings, CsgSettings } from '@/engine/geometry/csg/csg-settings';
import { Transform } from './transform';
import type { Material } from './material';
import type { Light } from './light';
import type { Skin } from './skin';
import type { Rig } from './rig';
export type EntityKind = 'group' | 'mesh' | 'light' | 'camera' | 'terrain' | 'character';
export interface EntityOptions {
    id: number;
    name: string;
    kind: EntityKind;
    mesh?: MeshData;
    material?: Material;
    light?: Light;
    terrain?: Terrain;
    rigidBody?: RigidBodySettings;
    character?: CharacterSettings;
    skin?: Skin;
    rig?: Rig;
    csg?: CsgSettings;
    csgBrush?: CsgBrushSettings;
    castShadows?: boolean;
    receiveShadows?: boolean;
    locked?: boolean;
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
    character: CharacterSettings | null;
    skin: Skin | null;
    rig: Rig | null;
    csg: CsgSettings | null;
    csgBrush: CsgBrushSettings | null;
    castShadows: boolean;
    receiveShadows: boolean;
    locked: boolean;
    constructor(options: EntityOptions) {
        this.id = options.id;
        this.name = options.name;
        this.kind = options.kind;
        this.mesh = options.mesh ?? null;
        this.material = options.material ?? null;
        this.light = options.light ?? null;
        this.terrain = options.terrain ?? null;
        this.rigidBody = options.rigidBody ?? null;
        this.character = options.character ?? null;
        this.skin = options.skin ?? null;
        this.rig = options.rig ?? null;
        this.csg = options.csg ?? null;
        this.csgBrush = options.csgBrush ?? null;
        this.castShadows = options.castShadows ?? true;
        this.receiveShadows = options.receiveShadows ?? true;
        this.locked = options.locked ?? false;
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
