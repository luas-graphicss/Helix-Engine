import { CLUSTER_MAX_TRIANGLES, CLUSTER_MAX_VERTICES, GROUP_TARGET_CLUSTERS, MAX_HIERARCHY_LEVELS, MIN_LEVEL_REDUCTION } from '../data/myriad-limits';
import { encloseSphere, sphereFromIndexedVertices, type Sphere } from './bounding-sphere';
import { computePlaneQuadrics, QUADRIC_FLOATS, simplifyEdgeCollapse, type PositionQuadrics, type SimplifyOutput } from './edge-collapse-simplifier';
import { partitionPoints, TrianglePartitioner } from './mesh-partitioner';
import { FloatKeyTable, type WeldedGeometry } from './vertex-welding';
export interface LevelGeometry {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    positionIds: Int32Array;
    positionCount: number;
}
export interface BuiltCluster {
    level: number;
    triangles: Uint32Array;
    generatingGroup: number;
    childGroup: number;
    sphere: Sphere;
}
export interface BuiltGroup {
    level: number;
    children: number[];
    sphere: Sphere;
    error: number;
}
export interface ClusterHierarchy {
    levels: LevelGeometry[];
    clusters: BuiltCluster[];
    groups: BuiltGroup[];
    roots: number[];
    leafTriangles: number;
}
export interface HierarchyProgress {
    level: number;
    clusters: number;
    triangles: number;
}
type LevelData = LevelGeometry & PositionQuadrics;
const VERTEX_KEY_FLOATS = 8;
const SHARED_POSITION = -2;
class LevelAccumulator {
    private vertexKeys = new Float32Array(1024 * VERTEX_KEY_FLOATS);
    private vertexPosition = new Int32Array(1024);
    private readonly vertexTable = new FloatKeyTable(VERTEX_KEY_FLOATS, 1024);
    private vertexCount = 0;
    private positionKeys = new Float32Array(1024 * 3);
    private quadrics = new Float64Array(1024 * QUADRIC_FLOATS);
    private weights = new Float64Array(1024);
    private deviations = new Float64Array(1024);
    private readonly positionTable = new FloatKeyTable(3, 1024);
    private positionCount = 0;
    absorb(output: SimplifyOutput, inherited: PositionQuadrics): Int32Array {
        const positionRemap = new Int32Array(output.positionCount).fill(-1);
        const remap = new Int32Array(output.positions.length / 3);
        for (let v = 0; v < remap.length; v++) {
            const p = output.positionIds[v];
            if (positionRemap[p] === -1)
                positionRemap[p] = this.addPosition(output, p, v, inherited);
            remap[v] = this.addVertex(output, v, positionRemap[p]);
        }
        return remap;
    }
    private addPosition(output: SimplifyOutput, position: number, vertex: number, inherited: PositionQuadrics): number {
        if ((this.positionCount + 1) * 3 > this.positionKeys.length)
            this.growPositions();
        const k = this.positionCount * 3;
        this.positionKeys[k] = output.positions[vertex * 3];
        this.positionKeys[k + 1] = output.positions[vertex * 3 + 1];
        this.positionKeys[k + 2] = output.positions[vertex * 3 + 2];
        const id = this.positionTable.insert(this.positionKeys, this.positionCount);
        const outQ = position * QUADRIC_FLOATS;
        if (id !== this.positionCount) {
            const srcQ = output.sourcePosition[position] * QUADRIC_FLOATS;
            for (let i = 0; i < QUADRIC_FLOATS; i++)
                this.quadrics[id * QUADRIC_FLOATS + i] += output.quadrics[outQ + i] - inherited.quadrics[srcQ + i];
            this.weights[id] += output.weights[position] - inherited.weights[output.sourcePosition[position]];
            this.deviations[id] = Math.max(this.deviations[id], output.deviations[position]);
            return id;
        }
        for (let i = 0; i < QUADRIC_FLOATS; i++)
            this.quadrics[id * QUADRIC_FLOATS + i] = output.quadrics[outQ + i];
        this.weights[id] = output.weights[position];
        this.deviations[id] = output.deviations[position];
        return this.positionCount++;
    }
    private addVertex(output: SimplifyOutput, vertex: number, positionId: number): number {
        if ((this.vertexCount + 1) * VERTEX_KEY_FLOATS > this.vertexKeys.length)
            this.growVertices();
        const k = this.vertexCount * VERTEX_KEY_FLOATS;
        this.vertexKeys[k] = output.positions[vertex * 3];
        this.vertexKeys[k + 1] = output.positions[vertex * 3 + 1];
        this.vertexKeys[k + 2] = output.positions[vertex * 3 + 2];
        this.vertexKeys[k + 3] = output.normals[vertex * 3];
        this.vertexKeys[k + 4] = output.normals[vertex * 3 + 1];
        this.vertexKeys[k + 5] = output.normals[vertex * 3 + 2];
        this.vertexKeys[k + 6] = output.uvs[vertex * 2];
        this.vertexKeys[k + 7] = output.uvs[vertex * 2 + 1];
        const id = this.vertexTable.insert(this.vertexKeys, this.vertexCount);
        if (id !== this.vertexCount)
            return id;
        this.vertexPosition[this.vertexCount] = positionId;
        return this.vertexCount++;
    }
    finish(): LevelData {
        const { vertexCount, vertexKeys } = this;
        const positions = new Float32Array(vertexCount * 3);
        const normals = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        for (let v = 0; v < vertexCount; v++) {
            const k = v * VERTEX_KEY_FLOATS;
            positions[v * 3] = vertexKeys[k];
            positions[v * 3 + 1] = vertexKeys[k + 1];
            positions[v * 3 + 2] = vertexKeys[k + 2];
            normals[v * 3] = vertexKeys[k + 3];
            normals[v * 3 + 1] = vertexKeys[k + 4];
            normals[v * 3 + 2] = vertexKeys[k + 5];
            uvs[v * 2] = vertexKeys[k + 6];
            uvs[v * 2 + 1] = vertexKeys[k + 7];
        }
        return {
            positions,
            normals,
            uvs,
            positionIds: this.vertexPosition.slice(0, vertexCount),
            positionCount: this.positionCount,
            quadrics: this.quadrics.slice(0, this.positionCount * QUADRIC_FLOATS),
            weights: this.weights.slice(0, this.positionCount),
            deviations: this.deviations.slice(0, this.positionCount),
        };
    }
    private growVertices(): void {
        const keys = new Float32Array(this.vertexKeys.length * 2);
        keys.set(this.vertexKeys);
        this.vertexKeys = keys;
        const vertexPosition = new Int32Array(this.vertexPosition.length * 2);
        vertexPosition.set(this.vertexPosition);
        this.vertexPosition = vertexPosition;
    }
    private growPositions(): void {
        const keys = new Float32Array(this.positionKeys.length * 2);
        keys.set(this.positionKeys);
        this.positionKeys = keys;
        const quadrics = new Float64Array(this.quadrics.length * 2);
        quadrics.set(this.quadrics);
        this.quadrics = quadrics;
        const weights = new Float64Array(this.weights.length * 2);
        weights.set(this.weights);
        this.weights = weights;
        const deviations = new Float64Array(this.deviations.length * 2);
        deviations.set(this.deviations);
        this.deviations = deviations;
    }
}
interface GroupSubmesh extends PositionQuadrics {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    positionIds: Int32Array;
    positionCount: number;
    locked: Uint8Array;
}
interface LevelScratch {
    localVertexOf: Int32Array;
    localPositionOf: Int32Array;
    positionOwner: Int32Array;
}
function markSharedPositions(level: LevelData, clusters: BuiltCluster[], current: number[], groupParts: Uint32Array[], positionOwner: Int32Array): void {
    positionOwner.fill(-1);
    for (let g = 0; g < groupParts.length; g++) {
        const part = groupParts[g];
        for (let i = 0; i < part.length; i++) {
            const { triangles } = clusters[current[part[i]]];
            for (let k = 0; k < triangles.length; k++) {
                const p = level.positionIds[triangles[k]];
                const owner = positionOwner[p];
                if (owner === -1)
                    positionOwner[p] = g;
                else if (owner !== g)
                    positionOwner[p] = SHARED_POSITION;
            }
        }
    }
}
function extractGroupSubmesh(level: LevelData, clusters: BuiltCluster[], members: number[], scratch: LevelScratch): GroupSubmesh {
    const { localVertexOf, localPositionOf, positionOwner } = scratch;
    let triangleCount = 0;
    for (const member of members)
        triangleCount += clusters[member].triangles.length / 3;
    const indices = new Uint32Array(triangleCount * 3);
    const positionIds = new Int32Array(triangleCount * 3);
    const globalVertices: number[] = [];
    const globalPositions: number[] = [];
    let written = 0;
    for (const member of members) {
        const { triangles } = clusters[member];
        for (let k = 0; k < triangles.length; k++) {
            const global = triangles[k];
            let local = localVertexOf[global];
            if (local === -1) {
                local = globalVertices.length;
                localVertexOf[global] = local;
                globalVertices.push(global);
                const globalPosition = level.positionIds[global];
                if (localPositionOf[globalPosition] === -1) {
                    localPositionOf[globalPosition] = globalPositions.length;
                    globalPositions.push(globalPosition);
                }
                positionIds[local] = localPositionOf[globalPosition];
            }
            indices[written++] = local;
        }
    }
    for (const global of globalVertices)
        localVertexOf[global] = -1;
    for (const global of globalPositions)
        localPositionOf[global] = -1;
    const vertexCount = globalVertices.length;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    for (let local = 0; local < vertexCount; local++) {
        const global = globalVertices[local];
        for (let k = 0; k < 3; k++) {
            positions[local * 3 + k] = level.positions[global * 3 + k];
            normals[local * 3 + k] = level.normals[global * 3 + k];
        }
        uvs[local * 2] = level.uvs[global * 2];
        uvs[local * 2 + 1] = level.uvs[global * 2 + 1];
    }
    const positionCount = globalPositions.length;
    const quadrics = new Float64Array(positionCount * QUADRIC_FLOATS);
    const weights = new Float64Array(positionCount);
    const deviations = new Float64Array(positionCount);
    const locked = new Uint8Array(positionCount);
    for (let local = 0; local < positionCount; local++) {
        const global = globalPositions[local];
        for (let i = 0; i < QUADRIC_FLOATS; i++)
            quadrics[local * QUADRIC_FLOATS + i] = level.quadrics[global * QUADRIC_FLOATS + i];
        weights[local] = level.weights[global];
        deviations[local] = level.deviations[global];
        if (positionOwner[global] === SHARED_POSITION)
            locked[local] = 1;
    }
    return { positions, normals, uvs, indices, positionIds: positionIds.slice(0, vertexCount), positionCount, quadrics, weights, deviations, locked };
}
function clusterCenters(clusters: BuiltCluster[], ids: number[]): Float32Array {
    const centers = new Float32Array(ids.length * 3);
    for (let i = 0; i < ids.length; i++) {
        const { sphere } = clusters[ids[i]];
        centers[i * 3] = sphere[0];
        centers[i * 3 + 1] = sphere[1];
        centers[i * 3 + 2] = sphere[2];
    }
    return centers;
}
function totalTriangles(clusters: BuiltCluster[], ids: number[]): number {
    let total = 0;
    for (const id of ids)
        total += clusters[id].triangles.length / 3;
    return total;
}
function sequence(length: number): Uint32Array {
    const out = new Uint32Array(length);
    for (let i = 0; i < length; i++)
        out[i] = i;
    return out;
}
interface LevelAttempt {
    accumulator: LevelAccumulator;
    groups: BuiltGroup[];
    clusters: Array<{
        triangles: Uint32Array;
        group: number;
    }>;
    triangles: number;
}
export function buildClusterHierarchy(welded: WeldedGeometry, onProgress?: (progress: HierarchyProgress) => void): ClusterHierarchy {
    const clusters: BuiltCluster[] = [];
    const groups: BuiltGroup[] = [];
    const levels: LevelGeometry[] = [];
    let level: LevelData = { ...welded, ...computePlaneQuadrics(welded.positions, welded.indices, welded.positionIds, welded.positionCount) };
    levels.push(level);
    const leafPartitioner = new TrianglePartitioner(welded.positions.length / 3);
    const leafParts = leafPartitioner.partition(welded.positions, welded.indices, null, CLUSTER_MAX_TRIANGLES, CLUSTER_MAX_VERTICES);
    let current: number[] = [];
    for (const part of leafParts) {
        const triangles = new Uint32Array(part.length * 3);
        for (let i = 0; i < part.length; i++) {
            triangles[i * 3] = welded.indices[part[i] * 3];
            triangles[i * 3 + 1] = welded.indices[part[i] * 3 + 1];
            triangles[i * 3 + 2] = welded.indices[part[i] * 3 + 2];
        }
        current.push(clusters.length);
        clusters.push({ level: 0, triangles, generatingGroup: -1, childGroup: -1, sphere: sphereFromIndexedVertices(welded.positions, triangles) });
    }
    onProgress?.({ level: 0, clusters: current.length, triangles: welded.indices.length / 3 });
    const attemptLevel = (groupParts: Uint32Array[], depth: number, scratch: LevelScratch): LevelAttempt => {
        markSharedPositions(level, clusters, current, groupParts, scratch.positionOwner);
        const accumulator = new LevelAccumulator();
        const pendingGroups: BuiltGroup[] = [];
        const pendingClusters: Array<{
            triangles: Uint32Array;
            group: number;
        }> = [];
        const groupBase = groups.length;
        let triangles = 0;
        for (let g = 0; g < groupParts.length; g++) {
            const members = Array.from(groupParts[g], (i) => current[i]);
            const submesh = extractGroupSubmesh(level, clusters, members, scratch);
            const triangleCount = submesh.indices.length / 3;
            const simplified = simplifyEdgeCollapse({ ...submesh, targetTriangles: Math.max(1, Math.floor(triangleCount / 2)) });
            const sphere = new Float32Array(clusters[members[0]].sphere);
            let error = simplified.error;
            for (const member of members) {
                const cluster = clusters[member];
                encloseSphere(sphere, cluster.sphere);
                if (cluster.generatingGroup >= 0) {
                    const generating = groups[cluster.generatingGroup];
                    encloseSphere(sphere, generating.sphere);
                    error = Math.max(error, generating.error);
                }
            }
            pendingGroups.push({ level: depth - 1, children: members, sphere, error });
            const remap = accumulator.absorb(simplified, submesh);
            const partitioner = new TrianglePartitioner(remap.length);
            const parts = partitioner.partition(simplified.positions, simplified.indices, null, CLUSTER_MAX_TRIANGLES, CLUSTER_MAX_VERTICES);
            for (const part of parts) {
                const packed = new Uint32Array(part.length * 3);
                for (let i = 0; i < part.length; i++) {
                    packed[i * 3] = remap[simplified.indices[part[i] * 3]];
                    packed[i * 3 + 1] = remap[simplified.indices[part[i] * 3 + 1]];
                    packed[i * 3 + 2] = remap[simplified.indices[part[i] * 3 + 2]];
                }
                pendingClusters.push({ triangles: packed, group: groupBase + g });
                triangles += part.length;
            }
        }
        return { accumulator, groups: pendingGroups, clusters: pendingClusters, triangles };
    };
    for (let depth = 1; current.length > 1 && depth < MAX_HIERARCHY_LEVELS; depth++) {
        const scratch: LevelScratch = {
            localVertexOf: new Int32Array(level.positions.length / 3).fill(-1),
            localPositionOf: new Int32Array(level.positionCount).fill(-1),
            positionOwner: new Int32Array(level.positionCount),
        };
        let groupParts = partitionPoints(clusterCenters(clusters, current), GROUP_TARGET_CLUSTERS);
        let attempt = attemptLevel(groupParts, depth, scratch);
        const limit = totalTriangles(clusters, current) * (1 - MIN_LEVEL_REDUCTION);
        if (attempt.triangles > limit && groupParts.length > 1) {
            groupParts = [sequence(current.length)];
            attempt = attemptLevel(groupParts, depth, scratch);
        }
        if (attempt.triangles > limit)
            break;
        const nextLevel = attempt.accumulator.finish();
        levels.push(nextLevel);
        const groupBase = groups.length;
        for (let g = 0; g < attempt.groups.length; g++) {
            for (const member of attempt.groups[g].children)
                clusters[member].childGroup = groupBase + g;
            groups.push(attempt.groups[g]);
        }
        const next: number[] = [];
        for (const pending of attempt.clusters) {
            next.push(clusters.length);
            clusters.push({
                level: depth,
                triangles: pending.triangles,
                generatingGroup: pending.group,
                childGroup: -1,
                sphere: sphereFromIndexedVertices(nextLevel.positions, pending.triangles),
            });
        }
        current = next;
        level = nextLevel;
        onProgress?.({ level: depth, clusters: next.length, triangles: attempt.triangles });
    }
    return { levels, clusters, groups, roots: current, leafTriangles: welded.indices.length / 3 };
}
