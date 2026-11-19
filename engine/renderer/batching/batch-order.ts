import type { CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import type { MaterialState } from './material-state';
export interface OrderedBatch {
    readonly state: MaterialState;
    readonly nearest: number;
    readonly variant: number;
}
export class ShaderVariantRegistry {
    private readonly ids = new WeakMap<CompiledShaderBundle, number>();
    private nextId = 1;
    resolve(state: MaterialState): number {
        const masked = state.alphaMode === 'mask' ? 1 : 0;
        if (!state.shader)
            return masked;
        const { bundle } = state.shader;
        let id = this.ids.get(bundle);
        if (id === undefined) {
            id = this.nextId++;
            this.ids.set(bundle, id);
        }
        return id * 2 + masked;
    }
}
export function byStateThenNearest(a: OrderedBatch, b: OrderedBatch): number {
    return a.state.id - b.state.id || a.nearest - b.nearest;
}
export function byVariantThenNearest(a: OrderedBatch, b: OrderedBatch): number {
    return a.variant - b.variant || byStateThenNearest(a, b);
}
