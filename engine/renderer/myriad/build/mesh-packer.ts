import { CLUSTER_MAX_TRIANGLES, CLUSTER_MAX_VERTICES, ROOT_PARENT_ERROR } from '../data/myriad-limits';
import type { PackedMyriadMesh } from '../data/myriad-mesh';
import type { ClusterHierarchy } from './hierarchy-builder';
const QUANT_MAX = 65535;
const SNORM_MAX = 32767;
export function floatToHalfBits(value: number): number {
    if (Number.isNaN(value))
        return 0x7e00;
    const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
    const magnitude = Math.abs(value);
    if (magnitude === 0)
        return sign;
    if (magnitude >= 65520)
        return sign | 0x7bff;
    if (magnitude < 6.103515625e-5) {
        return sign | Math.round(magnitude / 5.960464477539063e-8);
    }
    const exponent = Math.floor(Math.log2(magnitude));
    let mantissa = magnitude / 2 ** exponent - 1;
    let biased = exponent + 15;
    let bits = Math.round(mantissa * 1024);
    if (bits === 1024) {
        bits = 0;
        biased++;
    }
    if (biased >= 31)
        return sign | 0x7bff;
    return sign | (biased << 10) | bits;
}
function snorm16(value: number): number {
    return Math.round(Math.min(Math.max(value, -1), 1) * SNORM_MAX) & 0xffff;
}
function octEncode(x: number, y: number, z: number, out: Float64Array): void {
    const l1 = Math.abs(x) + Math.abs(y) + Math.abs(z);
    if (l1 < 1e-12) {
        out[0] = 0;
        out[1] = 1;
        return;
    }
    let ox = x / l1;
    let oy = y / l1;
    if (z < 0) {
        const tx = (1 - Math.abs(oy)) * (ox >= 0 ? 1 : -1);
        const ty = (1 - Math.abs(ox)) * (oy >= 0 ? 1 : -1);
        ox = tx;
        oy = ty;
    }
    out[0] = ox;
    out[1] = oy;
}
export function packHierarchy(hierarchy: ClusterHierarchy, buildMs: number): PackedMyriadMesh {
    const { clusters, groups, levels } = hierarchy;
    const clusterCount = clusters.length;
    let maxPoolVertices = 0;
    for (const level of levels)
        maxPoolVertices = Math.max(maxPoolVertices, level.positions.length / 3);
    const localIndexOf = new Int32Array(maxPoolVertices).fill(-1);
    const localVertices = new Int32Array(CLUSTER_MAX_VERTICES);
    let vertexTotal = 0;
    const vertexOffsets = new Uint32Array(clusterCount);
    const vertexCounts = new Uint16Array(clusterCount);
    for (let c = 0; c < clusterCount; c++) {
        vertexOffsets[c] = vertexTotal;
        const count = countUniqueVertices(clusters[c].triangles, localIndexOf);
        if (count > CLUSTER_MAX_VERTICES)
            throw new Error(`Cluster ${c} excede ${CLUSTER_MAX_VERTICES} vértices (${count}).`);
        vertexCounts[c] = count;
        vertexTotal += count;
    }
    const vertexData = new Uint32Array(vertexTotal * 4);
    const triangleData = new Uint8Array(clusterCount * CLUSTER_MAX_TRIANGLES * 4);
    const clusterSphere = new Float32Array(clusterCount * 4);
    const clusterBounds = new Float32Array(clusterCount * 8);
    const clusterInfo = new Uint32Array(clusterCount * 4);
    const clusterGeneratingGroup = new Int32Array(clusterCount);
    const clusterTriangleCount = new Uint16Array(clusterCount);
    const clusterLevel = new Uint8Array(clusterCount);
    const oct = new Float64Array(2);
    let totalTriangles = 0;
    for (let c = 0; c < clusterCount; c++) {
        const cluster = clusters[c];
        const level = levels[cluster.level];
        const { triangles } = cluster;
        const triangleCount = triangles.length / 3;
        totalTriangles += triangleCount;
        let localCount = 0;
        for (let i = 0; i < triangles.length; i++) {
            const global = triangles[i];
            if (localIndexOf[global] === -1) {
                localIndexOf[global] = localCount;
                localVertices[localCount++] = global;
            }
        }
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < localCount; i++) {
            const p = localVertices[i] * 3;
            const x = level.positions[p], y = level.positions[p + 1], z = level.positions[p + 2];
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
            if (y < minY)
                minY = y;
            if (y > maxY)
                maxY = y;
            if (z < minZ)
                minZ = z;
            if (z > maxZ)
                maxZ = z;
        }
        const extX = maxX - minX, extY = maxY - minY, extZ = maxZ - minZ;
        const vertexBase = vertexOffsets[c];
        for (let i = 0; i < localCount; i++) {
            const global = localVertices[i];
            const p = global * 3;
            const qx = extX > 0 ? Math.round(((level.positions[p] - minX) / extX) * QUANT_MAX) : 0;
            const qy = extY > 0 ? Math.round(((level.positions[p + 1] - minY) / extY) * QUANT_MAX) : 0;
            const qz = extZ > 0 ? Math.round(((level.positions[p + 2] - minZ) / extZ) * QUANT_MAX) : 0;
            octEncode(level.normals[p], level.normals[p + 1], level.normals[p + 2], oct);
            const o = (vertexBase + i) * 4;
            vertexData[o] = (qx | (qy << 16)) >>> 0;
            vertexData[o + 1] = qz;
            vertexData[o + 2] = (snorm16(oct[0]) | (snorm16(oct[1]) << 16)) >>> 0;
            vertexData[o + 3] = (floatToHalfBits(level.uvs[global * 2]) | (floatToHalfBits(level.uvs[global * 2 + 1]) << 16)) >>> 0;
        }
        const triangleBase = c * CLUSTER_MAX_TRIANGLES * 4;
        for (let t = 0; t < triangleCount; t++) {
            triangleData[triangleBase + t * 4] = localIndexOf[triangles[t * 3]];
            triangleData[triangleBase + t * 4 + 1] = localIndexOf[triangles[t * 3 + 1]];
            triangleData[triangleBase + t * 4 + 2] = localIndexOf[triangles[t * 3 + 2]];
        }
        for (let i = 0; i < localCount; i++)
            localIndexOf[localVertices[i]] = -1;
        clusterSphere.set(cluster.sphere, c * 4);
        const generating = cluster.generatingGroup;
        const child = cluster.childGroup;
        const b = c * 8;
        clusterBounds[b] = minX;
        clusterBounds[b + 1] = minY;
        clusterBounds[b + 2] = minZ;
        clusterBounds[b + 3] = generating >= 0 ? groups[generating].error : 0;
        clusterBounds[b + 4] = extX;
        clusterBounds[b + 5] = extY;
        clusterBounds[b + 6] = extZ;
        clusterBounds[b + 7] = child >= 0 ? groups[child].error : ROOT_PARENT_ERROR;
        const info = c * 4;
        clusterInfo[info] = vertexBase;
        clusterInfo[info + 1] = (triangleCount | (localCount << 16)) >>> 0;
        clusterInfo[info + 2] = (cluster.level | ((generating + 1) << 8)) >>> 0;
        clusterInfo[info + 3] = child + 1;
        clusterGeneratingGroup[c] = generating;
        clusterTriangleCount[c] = triangleCount;
        clusterLevel[c] = cluster.level;
    }
    const groupCount = groups.length;
    const groupSphere = new Float32Array(groupCount * 4);
    const groupError = new Float32Array(groupCount);
    const groupChildStart = new Uint32Array(groupCount + 1);
    let childTotal = 0;
    for (let g = 0; g < groupCount; g++) {
        groupSphere.set(groups[g].sphere, g * 4);
        groupError[g] = groups[g].error;
        groupChildStart[g] = childTotal;
        childTotal += groups[g].children.length;
    }
    groupChildStart[groupCount] = childTotal;
    const groupChildren = new Uint32Array(childTotal);
    for (let g = 0; g < groupCount; g++)
        groupChildren.set(groups[g].children, groupChildStart[g]);
    return {
        clusterCount,
        groupCount,
        vertexCount: vertexTotal,
        leafTriangles: hierarchy.leafTriangles,
        totalTriangles,
        levelCount: levels.length,
        vertexData,
        triangleData,
        clusterSphere,
        clusterBounds,
        clusterInfo,
        clusterGeneratingGroup,
        clusterTriangleCount,
        clusterLevel,
        groupSphere,
        groupError,
        groupChildStart,
        groupChildren,
        roots: Uint32Array.from(hierarchy.roots),
        buildMs,
    };
}
function countUniqueVertices(triangles: Uint32Array, localIndexOf: Int32Array): number {
    let count = 0;
    for (let i = 0; i < triangles.length; i++) {
        if (localIndexOf[triangles[i]] === -1) {
            localIndexOf[triangles[i]] = count++;
        }
    }
    for (let i = 0; i < triangles.length; i++)
        localIndexOf[triangles[i]] = -1;
    return count;
}
