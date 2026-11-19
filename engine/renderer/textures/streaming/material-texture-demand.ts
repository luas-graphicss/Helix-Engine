import * as aabb from '@/engine/core/math/aabb';
import { maxAxisScale } from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { MaterialState } from '@/engine/renderer/batching/material-state';
import type { MeshBatch } from '@/engine/renderer/batching/mesh-batcher';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { neededTextureSize } from './mip-demand';
import { uvDensity } from './uv-density';
const MIN_CLEARANCE = 0.05;
export class MaterialTextureDemand {
    private readonly sizes = new Map<MaterialState, number>();
    private pixelScale = 0;
    private cameraPosition: Vec3 | null = null;
    begin(pixelScale: number, cameraPosition: Vec3): void {
        this.sizes.clear();
        this.pixelScale = pixelScale;
        this.cameraPosition = cameraPosition;
    }
    add(batch: MeshBatch): void {
        const size = this.batchSize(batch);
        const known = this.sizes.get(batch.state);
        if (known === undefined || size > known)
            this.sizes.set(batch.state, size);
    }
    neededSize(state: MaterialState): number {
        return this.sizes.get(state) ?? Infinity;
    }
    private batchSize(batch: MeshBatch): number {
        const camera = this.cameraPosition;
        if (!camera || batch.state.shader !== null || batch.mesh.dynamic === true)
            return Infinity;
        const density = uvDensity(batch.mesh);
        if (batch.merged) {
            const clearance = aabb.distanceToPoint(getLocalBounds(batch.mesh), camera);
            return neededTextureSize(this.pixelsPerUnit(clearance, 1), density * batch.merged.material.uvTiling);
        }
        let largest = 0;
        for (const item of batch.items) {
            const { entity, bounds } = item.visible;
            const pixelsPerUnit = this.pixelsPerUnit(aabb.distanceToPoint(bounds.aabb, camera), maxAxisScale(entity.worldMatrix));
            const size = neededTextureSize(pixelsPerUnit, density * item.material.uvTiling);
            if (size > largest)
                largest = size;
        }
        return largest;
    }
    private pixelsPerUnit(clearance: number, scale: number): number {
        return clearance > MIN_CLEARANCE ? (this.pixelScale * scale) / clearance : Infinity;
    }
}
