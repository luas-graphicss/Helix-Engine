import type { Material } from '@/engine/core/scene/material';
const VALUE_COUNT = 14;
const MAX_KNOWN_VALUES = 4096;
interface CachedValues {
    readonly values: Float32Array;
    id: number;
}
function readValues(material: Material, out: Float32Array): void {
    out[0] = material.baseColor[0];
    out[1] = material.baseColor[1];
    out[2] = material.baseColor[2];
    out[3] = material.opacity;
    out[4] = material.roughness;
    out[5] = material.metallic;
    out[6] = material.emissiveIntensity;
    out[7] = material.emissive[0];
    out[8] = material.emissive[1];
    out[9] = material.emissive[2];
    out[10] = material.alphaCutoff;
    out[11] = material.normalScale;
    out[12] = material.occlusionStrength;
    out[13] = material.uvTiling;
}
function sameValues(a: Float32Array, b: Float32Array): boolean {
    for (let index = 0; index < VALUE_COUNT; index++) {
        if (a[index] !== b[index])
            return false;
    }
    return true;
}
export class MaterialValueRegistry {
    private readonly ids = new Map<string, number>();
    private readonly cache = new WeakMap<Material, CachedValues>();
    private readonly current = new Float32Array(VALUE_COUNT);
    private nextId = 1;
    resolve(material: Material): number {
        const { current } = this;
        readValues(material, current);
        const cached = this.cache.get(material);
        if (cached && sameValues(cached.values, current))
            return cached.id;
        const id = this.identify(current.join(','));
        if (cached) {
            cached.values.set(current);
            cached.id = id;
        }
        else {
            this.cache.set(material, { values: Float32Array.from(current), id });
        }
        return id;
    }
    private identify(key: string): number {
        const known = this.ids.get(key);
        if (known !== undefined)
            return known;
        if (this.ids.size >= MAX_KNOWN_VALUES)
            this.ids.clear();
        const id = this.nextId++;
        this.ids.set(key, id);
        return id;
    }
}
