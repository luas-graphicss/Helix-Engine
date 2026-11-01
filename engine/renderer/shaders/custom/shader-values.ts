import type { Texture } from '@/engine/core/scene/texture';
import type { CompiledShaderBundle, ShaderUniformDeclaration } from './shader-bundle';
export type ShaderUniformValue = number | boolean | ArrayLike<number> | Texture | ReadonlyArray<number | boolean | ArrayLike<number>>;
export class ShaderUniformValues {
    private readonly values = new Map<string, ShaderUniformValue>();
    version = 0;
    set(name: string, value: ShaderUniformValue): void {
        this.values.set(name, value);
        this.version++;
    }
    get(name: string): ShaderUniformValue | undefined {
        return this.values.get(name);
    }
    has(name: string): boolean {
        return this.values.has(name);
    }
    delete(name: string): boolean {
        const removed = this.values.delete(name);
        if (removed)
            this.version++;
        return removed;
    }
    names(): string[] {
        return Array.from(this.values.keys());
    }
    entries(): IterableIterator<[
        string,
        ShaderUniformValue
    ]> {
        return this.values.entries();
    }
    clone(): ShaderUniformValues {
        const copy = new ShaderUniformValues();
        for (const [name, value] of this.values)
            copy.values.set(name, value);
        return copy;
    }
    retainDeclared(bundle: CompiledShaderBundle): void {
        const declared = new Set(bundle.uniforms.map((entry) => entry.glslName));
        for (const key of Array.from(this.values.keys())) {
            if (!declared.has(key))
                this.values.delete(key);
        }
    }
}
export interface ShaderBinding {
    readonly id: number;
    bundle: CompiledShaderBundle;
    readonly values: ShaderUniformValues;
}
let nextBindingId = 1;
export function createShaderBinding(bundle: CompiledShaderBundle, values: ShaderUniformValues = new ShaderUniformValues()): ShaderBinding {
    return { id: nextBindingId++, bundle, values };
}
export function findUniformDeclaration(bundle: CompiledShaderBundle, name: string): ShaderUniformDeclaration | null {
    const direct = bundle.uniforms.filter((entry) => entry.name === name);
    if (direct.length === 1)
        return direct[0];
    if (direct.length > 1)
        return null;
    const dot = name.indexOf('.');
    if (dot <= 0)
        return null;
    const owner = name.slice(0, dot);
    const field = name.slice(dot + 1);
    return bundle.uniforms.find((entry) => entry.owner === owner && entry.name === field) ?? null;
}
export function ambiguousUniformNames(bundle: CompiledShaderBundle): Set<string> {
    const seen = new Set<string>();
    const ambiguous = new Set<string>();
    for (const entry of bundle.uniforms) {
        if (seen.has(entry.name))
            ambiguous.add(entry.name);
        seen.add(entry.name);
    }
    return ambiguous;
}
