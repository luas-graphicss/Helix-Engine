import { maxAxisScale } from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { projectedDiameterPixels } from '@/engine/renderer/culling/screen-coverage';
import { lodGroupPreview } from '@/engine/renderer/render-overrides';
import type { LodGroupSettings } from './lod-group-settings';
import { selectLodGroupLevel } from './lod-group-selector';
export interface LodGroupStats {
    groups: number;
    culled: number;
}
export interface LodGroupView {
    readonly camera: PerspectiveCamera;
    readonly pixelScale: number;
    readonly viewportHeight: number;
    readonly enabled: boolean;
}
export class LodGroupVisibility {
    readonly stats: LodGroupStats = { groups: 0, culled: 0 };
    private readonly hidden = new Set<Entity>();
    private readonly levels = new WeakMap<Entity, number>();
    private view: LodGroupView | null = null;
    beginFrame(view: LodGroupView): void {
        this.view = view;
        this.hidden.clear();
        this.stats.groups = 0;
        this.stats.culled = 0;
    }
    hides(entity: Entity): boolean {
        const { hidden } = this;
        if (hidden.size > 0 && (hidden.has(entity) || (entity.parent !== null && hidden.has(entity.parent)))) {
            hidden.add(entity);
            return true;
        }
        if (entity.lodGroup)
            this.showActiveLevel(entity, entity.lodGroup);
        return false;
    }
    private showActiveLevel(group: Entity, settings: LodGroupSettings): void {
        const levelCount = Math.min(settings.screenHeights.length, group.children.length);
        if (levelCount === 0)
            return;
        const active = this.activeLevel(group, settings, levelCount);
        this.stats.groups++;
        if (active >= levelCount)
            this.stats.culled++;
        for (let level = 0; level < levelCount; level++) {
            if (level !== active)
                this.hidden.add(group.children[level]);
        }
    }
    private activeLevel(group: Entity, settings: LodGroupSettings, levelCount: number): number {
        const preview = lodGroupPreview(group);
        if (preview !== null)
            return Math.min(preview, levelCount - 1);
        const { view } = this;
        if (!view || !view.enabled)
            return 0;
        const matrix = group.worldMatrix;
        const { position } = view.camera;
        const distance = Math.hypot(matrix[12] - position[0], matrix[13] - position[1], matrix[14] - position[2]);
        const diameter = projectedDiameterPixels(settings.radius * maxAxisScale(matrix), distance, view.pixelScale);
        const level = selectLodGroupLevel(settings.screenHeights, levelCount, diameter / view.viewportHeight, this.levels.get(group));
        this.levels.set(group, level);
        return level;
    }
}
