import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { Material } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
export type AssetKind = 'mesh' | 'texture' | 'material';
interface AssetBase {
    readonly id: string;
    readonly kind: AssetKind;
    name: string;
    readonly source: string;
}
export interface MeshAsset extends AssetBase {
    readonly kind: 'mesh';
    readonly mesh: MeshData;
    readonly material: Material | null;
}
export interface TextureAsset extends AssetBase {
    readonly kind: 'texture';
    readonly texture: Texture;
}
export interface MaterialAsset extends AssetBase {
    readonly kind: 'material';
    readonly material: Material;
}
export type Asset = MeshAsset | TextureAsset | MaterialAsset;
export class AssetLibrary {
    private readonly items = new Map<string, Asset>();
    private nextId = 1;
    constructor(private readonly onChange: () => void) { }
    get all(): Asset[] {
        return Array.from(this.items.values());
    }
    get size(): number {
        return this.items.size;
    }
    byKind<K extends AssetKind>(kind: K): Array<Extract<Asset, {
        kind: K;
    }>> {
        return this.all.filter((asset): asset is Extract<Asset, {
            kind: K;
        }> => asset.kind === kind);
    }
    get(id: string): Asset | null {
        return this.items.get(id) ?? null;
    }
    addMesh(name: string, mesh: MeshData, material: Material | null, source: string): MeshAsset {
        return this.register({ id: this.allocateId('mesh'), kind: 'mesh', name, mesh, material, source });
    }
    addTexture(texture: Texture, source: string): TextureAsset {
        return this.register({ id: this.allocateId('texture'), kind: 'texture', name: texture.name, texture, source });
    }
    addMaterial(material: Material, source: string): MaterialAsset {
        return this.register({ id: this.allocateId('material'), kind: 'material', name: material.name, material, source });
    }
    remove(id: string): void {
        if (this.items.delete(id))
            this.onChange();
    }
    private register<T extends Asset>(asset: T): T {
        this.items.set(asset.id, asset);
        this.onChange();
        return asset;
    }
    private allocateId(kind: AssetKind): string {
        return `${kind}_${this.nextId++}`;
    }
}
