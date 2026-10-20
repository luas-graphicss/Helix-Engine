import type { PackedMyriadMesh } from '../data/myriad-mesh';
import { buildClusterHierarchy } from './hierarchy-builder';
import { packHierarchy } from './mesh-packer';
import { weldGeometry } from './vertex-welding';
export interface MyriadBuildInput {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
}
export interface MyriadBuildProgress {
    phase: 'weld' | 'hierarchy' | 'pack';
    level: number;
    levelClusters: number;
    levelTriangles: number;
}
export function buildMyriadMesh(input: MyriadBuildInput, onProgress?: (progress: MyriadBuildProgress) => void): PackedMyriadMesh {
    const started = performance.now();
    onProgress?.({ phase: 'weld', level: 0, levelClusters: 0, levelTriangles: input.indices.length / 3 });
    const welded = weldGeometry(input.positions, input.normals, input.uvs, input.indices);
    const hierarchy = buildClusterHierarchy(welded, (progress) => {
        onProgress?.({ phase: 'hierarchy', level: progress.level, levelClusters: progress.clusters, levelTriangles: progress.triangles });
    });
    onProgress?.({ phase: 'pack', level: hierarchy.levels.length - 1, levelClusters: hierarchy.clusters.length, levelTriangles: 0 });
    return packHierarchy(hierarchy, performance.now() - started);
}
