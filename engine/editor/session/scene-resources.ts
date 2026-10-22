import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { Material } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
export type SceneResourceKind = 'mesh' | 'texture';
interface SceneResourceBase {
    readonly id: string;
    readonly kind: SceneResourceKind;
    name: string;
    readonly source: string;
}
export interface MeshResource extends SceneResourceBase {
    readonly kind: 'mesh';
    readonly mesh: MeshData;
    readonly material: Material | null;
}
export interface TextureResource extends SceneResourceBase {
    readonly kind: 'texture';
    readonly texture: Texture;
}
export type SceneResource = MeshResource | TextureResource;
export class SceneResources {
    private readonly items = new Map<string, SceneResource>();
    private nextId = 1;
    constructor(private readonly onChange: () => void) { }
    get size(): number {
        return this.items.size;
    }
    byKind<K extends SceneResourceKind>(kind: K): Array<Extract<SceneResource, {
        kind: K;
    }>> {
        return Array.from(this.items.values()).filter((resource): resource is Extract<SceneResource, {
            kind: K;
        }> => resource.kind === kind);
    }
    addMesh(name: string, mesh: MeshData, material: Material | null, source: string): MeshResource {
        return this.register({ id: this.allocateId('mesh'), kind: 'mesh', name, mesh, material, source });
    }
    addTexture(texture: Texture, source: string): TextureResource {
        return this.register({ id: this.allocateId('texture'), kind: 'texture', name: texture.name, texture, source });
    }
    private register<T extends SceneResource>(resource: T): T {
        this.items.set(resource.id, resource);
        this.onChange();
        return resource;
    }
    private allocateId(kind: SceneResourceKind): string {
        return `${kind}_${this.nextId++}`;
    }
}
