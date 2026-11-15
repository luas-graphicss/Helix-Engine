import type { Entity } from '@/engine/core/scene/entity';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { ShadowCasterCandidate, VisibleMesh } from '@/engine/renderer/culling/visible-set';
import type { ShadowMapBinding } from '@/engine/renderer/passes/shadow-pass';
import { entityLodOverride } from '@/engine/renderer/render-overrides';
import { LodChainCache, MAX_LOD_LEVELS } from './lod-chain';
import { MESH_LOD_THRESHOLD_PIXELS, selectLodLevel, type LodSettings } from './lod-selector';
export interface LodStats {
    readonly perLevel: Uint32Array;
    pending: number;
}
type LevelMemory = WeakMap<Entity, number>;
export class LodSystem {
    readonly stats: LodStats = { perLevel: new Uint32Array(MAX_LOD_LEVELS), pending: 0 };
    private readonly chains = new LodChainCache();
    private readonly viewLevels: LevelMemory = new WeakMap();
    private readonly probeLevels: LevelMemory = new WeakMap();
    private settings: LodSettings = { enabled: true, bias: 0 };
    beginFrame(settings: LodSettings): void {
        this.settings = settings;
        this.stats.perLevel.fill(0);
        this.chains.pump();
        this.stats.pending = this.chains.pending;
    }
    readonly resolveMesh = (visible: VisibleMesh): MeshData => this.resolve(visible, this.viewLevels);
    readonly resolveProbeMesh = (visible: VisibleMesh): MeshData => this.resolve(visible, this.probeLevels);
    createShadowResolver(binding: ShadowMapBinding): (candidate: ShadowCasterCandidate, cascade: number) => MeshData {
        return (candidate, cascade) => {
            if (!this.settings.enabled)
                return candidate.mesh;
            const chain = this.chains.resolve(candidate.mesh);
            const viewLevel = this.viewLevels.get(candidate.entity);
            if (viewLevel !== undefined)
                return chain.levels[Math.min(viewLevel, chain.levels.length - 1)];
            const texels = (candidate.bounds.radius * 2) / Math.max(binding.texelWorldSizes[cascade], 1e-6);
            return chain.levels[selectLodLevel(texels, MESH_LOD_THRESHOLD_PIXELS, chain.levels.length, this.settings.bias, -1)];
        };
    }
    dispose(): void {
        this.chains.dispose();
    }
    private resolve(visible: VisibleMesh, levels: LevelMemory): MeshData {
        const override = entityLodOverride(visible.entity);
        if (!this.settings.enabled || (override && !override.enabled)) {
            this.stats.perLevel[0]++;
            return visible.mesh;
        }
        const chain = this.chains.resolve(visible.mesh);
        const previous = levels.get(visible.entity) ?? -1;
        const level = selectLodLevel(visible.pixelSize, MESH_LOD_THRESHOLD_PIXELS, chain.levels.length, this.settings.bias + (override?.bias ?? 0), previous);
        levels.set(visible.entity, level);
        this.stats.perLevel[level]++;
        return chain.levels[level];
    }
}
