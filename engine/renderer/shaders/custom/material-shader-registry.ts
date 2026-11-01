import type { Material } from '@/engine/core/scene/material';
import type { ShaderBinding } from './shader-values';
const bindings = new WeakMap<Material, ShaderBinding>();
export function setMaterialShader(material: Material, binding: ShaderBinding | null): void {
    if (binding)
        bindings.set(material, binding);
    else
        bindings.delete(material);
}
export function materialShader(material: Material): ShaderBinding | null {
    return bindings.get(material) ?? null;
}
