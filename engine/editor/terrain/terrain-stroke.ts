import type { Command } from '@/engine/editor/history/command';
import { HeightsRegionCommand, SplatRegionCommand } from '@/engine/editor/commands/terrain-commands';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { createRegion, isRegionEmpty, unionRegion, type GridRegion, type Heightfield } from '@/engine/terrain/core/heightfield';
import type { SplatMap } from '@/engine/terrain/core/splat-map';
export type StrokeKind = 'heights' | 'splat';
export class TerrainStroke {
    readonly region: GridRegion = createRegion();
    private readonly originHeights: Heightfield | null;
    private readonly originSplat: SplatMap | null;
    constructor(readonly terrain: Terrain, readonly kind: StrokeKind) {
        this.originHeights = kind === 'heights' ? terrain.heightfield.clone() : null;
        this.originSplat = kind === 'splat' ? terrain.splat.clone() : null;
    }
    extend(region: GridRegion): void {
        unionRegion(this.region, region);
    }
    finish(label: string): Command | null {
        if (isRegionEmpty(this.region))
            return null;
        const region = { ...this.region };
        if (this.originHeights) {
            const { heightfield } = this.terrain;
            return new HeightsRegionCommand(label, this.terrain, heightfield, region, this.originHeights.copyRegion(region), heightfield.copyRegion(region));
        }
        if (this.originSplat) {
            const { splat } = this.terrain;
            return new SplatRegionCommand(label, this.terrain, splat, region, this.originSplat.copyRegion(region), splat.copyRegion(region));
        }
        return null;
    }
}
