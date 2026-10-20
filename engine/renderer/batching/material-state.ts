import type { AlphaMode, Material, MaterialTextureSlot } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
export const MATERIAL_MAP_SLOTS: readonly MaterialTextureSlot[] = ['baseColorMap', 'metallicRoughnessMap', 'normalMap', 'occlusionMap', 'emissiveMap'];
export interface MaterialState {
    readonly id: number;
    readonly alphaMode: AlphaMode;
    readonly doubleSided: boolean;
    readonly textures: ReadonlyArray<Texture | null>;
}
interface CachedState {
    state: MaterialState;
    readonly textures: Array<Texture | null>;
    alphaMode: AlphaMode;
    doubleSided: boolean;
}
export class MaterialStateRegistry {
    private readonly byKey = new Map<string, MaterialState>();
    private readonly cache = new WeakMap<Material, CachedState>();
    private nextId = 1;
    resolve(material: Material): MaterialState {
        const cached = this.cache.get(material);
        if (cached && this.matches(cached, material))
            return cached.state;
        const textures = MATERIAL_MAP_SLOTS.map((slot) => material[slot]);
        const key = `${material.alphaMode}|${material.doubleSided ? 1 : 0}|${textures.map((texture) => texture?.id ?? 0).join(',')}`;
        let state = this.byKey.get(key);
        if (!state) {
            state = { id: this.nextId++, alphaMode: material.alphaMode, doubleSided: material.doubleSided, textures };
            this.byKey.set(key, state);
        }
        this.cache.set(material, { state, textures, alphaMode: material.alphaMode, doubleSided: material.doubleSided });
        return state;
    }
    private matches(cached: CachedState, material: Material): boolean {
        if (cached.alphaMode !== material.alphaMode || cached.doubleSided !== material.doubleSided)
            return false;
        for (let i = 0; i < MATERIAL_MAP_SLOTS.length; i++) {
            if (cached.textures[i] !== material[MATERIAL_MAP_SLOTS[i]])
                return false;
        }
        return true;
    }
}
