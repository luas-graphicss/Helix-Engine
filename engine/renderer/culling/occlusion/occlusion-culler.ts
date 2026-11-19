import type { Aabb } from '@/engine/core/math/aabb';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { materialShader } from '@/engine/renderer/shaders/custom/material-shader-registry';
import type { RenderableBounds } from '../renderable-bounds';
import { OcclusionBuffer } from './occlusion-buffer';
import { OccluderRasterizer } from './occluder-rasterizer';
const MIN_OCCLUDER_PIXEL_SIZE = 48;
const MAX_OCCLUDER_MESH_TRIANGLES = 2048;
const MAX_OCCLUDERS = 96;
const MAX_FRAME_TRIANGLES = 24000;
const MIN_NEAR = 1e-4;
const BOX_CORNERS = 8;
export interface OcclusionCandidate {
    readonly entity: Entity;
    readonly mesh: MeshData;
    readonly bounds: RenderableBounds;
    readonly pixelSize: number;
}
export interface OcclusionStats {
    occluders: number;
    occluderTriangles: number;
    culled: number;
}
function canOcclude(candidate: OcclusionCandidate): boolean {
    const { entity, mesh } = candidate;
    if (entity.skin !== null || entity.csgBrush !== null)
        return false;
    if (candidate.pixelSize < MIN_OCCLUDER_PIXEL_SIZE || mesh.indices.length > MAX_OCCLUDER_MESH_TRIANGLES * 3)
        return false;
    const { material } = entity;
    return material === null || (material.alphaMode === 'opaque' && materialShader(material) === null);
}
function byLargestOnScreen(a: OcclusionCandidate, b: OcclusionCandidate): number {
    if (a.pixelSize === b.pixelSize)
        return 0;
    return a.pixelSize > b.pixelSize ? -1 : 1;
}
export class OcclusionCuller {
    readonly stats: OcclusionStats = { occluders: 0, occluderTriangles: 0, culled: 0 };
    private readonly buffer = new OcclusionBuffer();
    private readonly rasterizer = new OccluderRasterizer();
    private readonly candidates: OcclusionCandidate[] = [];
    private readonly occluders: OcclusionCandidate[] = [];
    cull<TItem extends OcclusionCandidate>(items: TItem[], camera: PerspectiveCamera): void {
        const { stats, buffer, occluders } = this;
        stats.culled = 0;
        this.selectOccluders(items);
        if (occluders.length === 0)
            return;
        const near = Math.max(camera.near, MIN_NEAR);
        const viewProjection = camera.viewProjectionMatrix;
        buffer.clear();
        for (const occluder of occluders)
            this.rasterizer.draw(buffer, occluder.mesh, occluder.entity.worldMatrix, viewProjection, near);
        buffer.build();
        let kept = 0;
        for (let index = 0; index < items.length; index++) {
            if (!this.isHidden(items[index].bounds.aabb, viewProjection, near))
                items[kept++] = items[index];
        }
        stats.culled = items.length - kept;
        items.length = kept;
        occluders.length = 0;
    }
    private selectOccluders(items: readonly OcclusionCandidate[]): void {
        const { candidates, occluders, stats } = this;
        candidates.length = 0;
        occluders.length = 0;
        stats.occluderTriangles = 0;
        for (const item of items) {
            if (canOcclude(item))
                candidates.push(item);
        }
        candidates.sort(byLargestOnScreen);
        for (const candidate of candidates) {
            const triangles = candidate.mesh.indices.length / 3;
            if (stats.occluderTriangles + triangles > MAX_FRAME_TRIANGLES)
                continue;
            occluders.push(candidate);
            stats.occluderTriangles += triangles;
            if (occluders.length >= MAX_OCCLUDERS)
                break;
        }
        candidates.length = 0;
        stats.occluders = occluders.length;
    }
    private isHidden(box: Aabb, m: Mat4, near: number): boolean {
        const { buffer } = this;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let nearestDepth = Infinity;
        for (let corner = 0; corner < BOX_CORNERS; corner++) {
            const x = corner & 1 ? box.max[0] : box.min[0];
            const y = corner & 2 ? box.max[1] : box.min[1];
            const z = corner & 4 ? box.max[2] : box.min[2];
            const w = m[3] * x + m[7] * y + m[11] * z + m[15];
            const clipZ = m[2] * x + m[6] * y + m[10] * z + m[14];
            if (w < near || clipZ + w < 0)
                return false;
            const ndcX = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
            const ndcY = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
            minX = Math.min(minX, ndcX);
            maxX = Math.max(maxX, ndcX);
            minY = Math.min(minY, ndcY);
            maxY = Math.max(maxY, ndcY);
            nearestDepth = Math.min(nearestDepth, w);
        }
        return buffer.isOccluded(buffer.pixelX(minX), buffer.pixelY(minY), buffer.pixelX(maxX), buffer.pixelY(maxY), 1 / nearestDepth);
    }
}
