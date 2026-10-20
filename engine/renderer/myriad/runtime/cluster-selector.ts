import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import { MAX_HIERARCHY_LEVELS } from '../data/myriad-limits';
import type { EntryList } from './frame-data';
import type { MyriadMeshEntry } from './myriad-mesh-cache';
export interface ErrorProjector {
    perspective: boolean;
    cameraPosition: Vec3;
    pixelScale: number;
    near: number;
    texelSize: number;
}
export interface SelectionRequest {
    entry: MyriadMeshEntry;
    world: Float32Array;
    scale: number;
    instance: number;
    state: number;
    doubleSided: boolean;
    frustum: Frustum | null;
    projector: ErrorProjector;
    threshold: number;
}
export interface SelectionStats {
    groupsVisited: number;
    frustumCulled: number;
    clusters: number;
    triangles: number;
    readonly perLevel: Uint32Array;
}
const INITIAL_STACK = 1024;
export class ClusterSelector {
    readonly stats: SelectionStats = { groupsVisited: 0, frustumCulled: 0, clusters: 0, triangles: 0, perLevel: new Uint32Array(MAX_HIERARCHY_LEVELS) };
    private stack = new Int32Array(INITIAL_STACK);
    private stamp = 0;
    private readonly center = vec3.create();
    resetStats(): void {
        const { stats } = this;
        stats.groupsVisited = 0;
        stats.frustumCulled = 0;
        stats.clusters = 0;
        stats.triangles = 0;
        stats.perLevel.fill(0);
    }
    select(request: SelectionRequest, out: EntryList): void {
        const { entry, world, scale, frustum, projector, threshold } = request;
        const packed = entry.packed;
        const residency = entry.residency;
        const stamps = entry.groupStamp;
        if (!packed || !residency || !stamps)
            return;
        const { stats, center } = this;
        const { clusterGeneratingGroup, groupError, groupSphere, groupChildStart, groupChildren, clusterSphere, clusterLevel, clusterTriangleCount, roots } = packed;
        const stamp = ++this.stamp;
        const clusterBase = residency.clusterBase;
        let top = 0;
        for (let i = 0; i < roots.length; i++)
            top = this.push(top, roots[i]);
        while (top > 0) {
            const cluster = this.stack[--top];
            const group = clusterGeneratingGroup[cluster];
            let projected = 0;
            if (group >= 0) {
                transformCenter(center, world, groupSphere, group * 4);
                const radius = groupSphere[group * 4 + 3] * scale;
                projected = this.projectError(groupError[group] * scale, center, radius, projector);
            }
            if (projected <= threshold) {
                if (frustum) {
                    transformCenter(center, world, clusterSphere, cluster * 4);
                    if (!frustum.intersectsSphere(center, clusterSphere[cluster * 4 + 3] * scale)) {
                        stats.frustumCulled++;
                        continue;
                    }
                }
                out.push(clusterBase + cluster, request.instance, request.state, world, request.doubleSided);
                stats.clusters++;
                stats.triangles += clusterTriangleCount[cluster];
                stats.perLevel[clusterLevel[cluster]]++;
                continue;
            }
            if (stamps[group] === stamp)
                continue;
            stamps[group] = stamp;
            if (frustum && !frustum.intersectsSphere(center, groupSphere[group * 4 + 3] * scale)) {
                stats.frustumCulled++;
                continue;
            }
            stats.groupsVisited++;
            const end = groupChildStart[group + 1];
            for (let i = groupChildStart[group]; i < end; i++)
                top = this.push(top, groupChildren[i]);
        }
    }
    private projectError(error: number, center: Vec3, radius: number, projector: ErrorProjector): number {
        if (!projector.perspective)
            return error / Math.max(projector.texelSize, 1e-6);
        const distance = Math.max(vec3.distance(projector.cameraPosition, center) - radius, projector.near);
        return (error * projector.pixelScale) / distance;
    }
    private push(top: number, cluster: number): number {
        if (top === this.stack.length) {
            const grown = new Int32Array(this.stack.length * 2);
            grown.set(this.stack);
            this.stack = grown;
        }
        this.stack[top] = cluster;
        return top + 1;
    }
}
function transformCenter(out: Vec3, m: Float32Array, spheres: Float32Array, offset: number): void {
    const x = spheres[offset], y = spheres[offset + 1], z = spheres[offset + 2];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
}
