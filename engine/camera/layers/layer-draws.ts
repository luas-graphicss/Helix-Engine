import type { Scene } from '@/engine/core/scene/scene';
import { ALL_RENDER_LAYERS, maskIncludesLayer } from './render-layers';
interface EntityDraw {
    readonly entityId: number;
}
export function drawsInMask<T extends EntityDraw>(scene: Scene, draws: readonly T[], mask: number): readonly T[] {
    if (mask === ALL_RENDER_LAYERS)
        return draws;
    return draws.filter((draw) => {
        const entity = scene.findById(draw.entityId);
        return !entity || maskIncludesLayer(mask, entity.layer);
    });
}
