import type { Command } from '@/engine/editor/history/command';
import type { Terrain } from '@/engine/terrain/core/terrain';
import type { GridRegion, Heightfield } from '@/engine/terrain/core/heightfield';
import type { SplatMap } from '@/engine/terrain/core/splat-map';
import type { TerrainLayer } from '@/engine/terrain/core/terrain-layer';
import type { GrassMap } from '@/engine/terrain/foliage/grass-map';
export class HeightsRegionCommand implements Command {
    constructor(readonly label: string, private readonly terrain: Terrain, private readonly heightfield: Heightfield, private readonly region: GridRegion, private readonly before: Float32Array, private readonly after: Float32Array) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    private apply(data: Float32Array): void {
        if (this.terrain.heightfield !== this.heightfield)
            return;
        this.heightfield.pasteRegion(this.region, data);
        this.terrain.heightsChanged(this.region);
    }
}
export class SplatRegionCommand implements Command {
    constructor(readonly label: string, private readonly terrain: Terrain, private readonly splat: SplatMap, private readonly region: GridRegion, private readonly before: Uint8Array, private readonly after: Uint8Array) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    private apply(block: Uint8Array): void {
        if (this.terrain.splat !== this.splat)
            return;
        this.splat.pasteRegion(this.region, block);
        this.terrain.markSplatDirty(this.region);
    }
}
export class GrassRegionCommand implements Command {
    constructor(readonly label: string, private readonly terrain: Terrain, private readonly grassMap: GrassMap, private readonly region: GridRegion, private readonly before: Uint8Array, private readonly after: Uint8Array) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    private apply(block: Uint8Array): void {
        if (this.terrain.grassMap !== this.grassMap)
            return;
        this.grassMap.pasteRegion(this.region, block);
        this.terrain.grassChanged(this.region);
    }
}
export class GrassSnapshotCommand implements Command {
    constructor(readonly label: string, private readonly terrain: Terrain, private readonly grassMap: GrassMap, private readonly before: GrassMap, private readonly after: GrassMap) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    private apply(snapshot: GrassMap): void {
        if (this.terrain.grassMap !== this.grassMap)
            return;
        this.grassMap.copyFrom(snapshot);
        this.terrain.grassChanged();
    }
}
export class SplatSnapshotCommand implements Command {
    constructor(readonly label: string, private readonly terrain: Terrain, private readonly splat: SplatMap, private readonly before: SplatMap, private readonly after: SplatMap) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    private apply(snapshot: SplatMap): void {
        if (this.terrain.splat !== this.splat)
            return;
        this.splat.copyFrom(snapshot);
        this.terrain.markSplatDirty();
    }
}
export interface TerrainDataState {
    heightfield: Heightfield;
    splat: SplatMap;
    grassMap: GrassMap;
    size: number;
}
export class ReplaceTerrainDataCommand implements Command {
    constructor(readonly label: string, private readonly terrain: Terrain, private readonly before: TerrainDataState, private readonly after: TerrainDataState) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    private apply(state: TerrainDataState): void {
        this.terrain.replaceHeightfield(state.heightfield, state.size);
        this.terrain.replaceSplat(state.splat);
        this.terrain.replaceGrassMap(state.grassMap);
    }
}
export class AddLayerCommand implements Command {
    readonly label: string;
    constructor(private readonly terrain: Terrain, private readonly layer: TerrainLayer, private readonly index: number = terrain.layers.length) {
        this.label = `Adicionar camada ${layer.name}`;
    }
    execute(): void {
        this.terrain.layers.splice(this.index, 0, this.layer);
    }
    undo(): void {
        const index = this.terrain.layers.indexOf(this.layer);
        if (index !== -1)
            this.terrain.layers.splice(index, 1);
    }
}
export class RemoveLayerCommand implements Command {
    readonly label: string;
    private readonly splat: SplatMap;
    private readonly splatBefore: SplatMap;
    constructor(private readonly terrain: Terrain, private readonly layer: TerrainLayer, private readonly index: number) {
        this.label = `Remover camada ${layer.name}`;
        this.splat = terrain.splat;
        this.splatBefore = terrain.splat.clone();
    }
    execute(): void {
        const index = this.terrain.layers.indexOf(this.layer);
        if (index === -1)
            return;
        this.terrain.layers.splice(index, 1);
        if (this.terrain.splat === this.splat)
            this.splat.removeLayer(index);
        this.terrain.markSplatDirty();
    }
    undo(): void {
        this.terrain.layers.splice(this.index, 0, this.layer);
        if (this.terrain.splat === this.splat)
            this.splat.copyFrom(this.splatBefore);
        this.terrain.markSplatDirty();
    }
}
export class SwapLayersCommand implements Command {
    readonly label: string;
    constructor(private readonly terrain: Terrain, private readonly a: number, private readonly b: number) {
        this.label = 'Reordenar camadas';
    }
    execute(): void {
        this.swap();
    }
    undo(): void {
        this.swap();
    }
    private swap(): void {
        const { layers, splat } = this.terrain;
        if (this.a >= layers.length || this.b >= layers.length)
            return;
        const temp = layers[this.a];
        layers[this.a] = layers[this.b];
        layers[this.b] = temp;
        splat.swapLayers(this.a, this.b);
        this.terrain.markSplatDirty();
    }
}
