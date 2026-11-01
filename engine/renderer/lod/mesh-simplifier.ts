import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { computePlaneQuadrics, simplifyEdgeCollapse, type PositionQuadrics } from '../myriad/build/edge-collapse-simplifier';
import { weldGeometry } from '../myriad/build/vertex-welding';
export interface SimplifierInput {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
}
export interface SimplifierOutput {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
}
export interface SimplifierState extends PositionQuadrics {
    positionIds: Int32Array;
    positionCount: number;
}
export interface SimplifiedLevel {
    output: SimplifierOutput;
    state: SimplifierState;
    error: number;
}
export function simplifyToTriangles(input: SimplifierInput, targetTriangles: number, state: SimplifierState | null): SimplifiedLevel {
    const indices = input.indices instanceof Uint32Array ? input.indices : Uint32Array.from(input.indices);
    const welded = state
        ? { positions: input.positions, normals: input.normals, uvs: input.uvs, indices, positionIds: state.positionIds, positionCount: state.positionCount }
        : weldGeometry(input.positions, input.normals, input.uvs, indices);
    const quadrics: PositionQuadrics = state ?? computePlaneQuadrics(welded.positions, welded.indices, welded.positionIds, welded.positionCount);
    const result = simplifyEdgeCollapse({
        ...welded,
        ...quadrics,
        locked: new Uint8Array(welded.positionCount),
        targetTriangles: Math.max(1, Math.floor(targetTriangles)),
    });
    return {
        output: {
            positions: result.positions,
            normals: result.normals,
            uvs: result.uvs,
            indices: createIndexArray(result.indices, result.positions.length / 3),
        },
        state: {
            positionIds: result.positionIds,
            positionCount: result.positionCount,
            quadrics: result.quadrics,
            weights: result.weights,
            deviations: result.deviations,
        },
        error: result.error,
    };
}
export function simplifyByRatio(input: SimplifierInput, ratio: number): SimplifierOutput {
    const triangles = input.indices.length / 3;
    const target = Math.max(1, Math.round(triangles * Math.min(1, Math.max(0, ratio))));
    return simplifyToTriangles(input, target, null).output;
}
export function toMeshData(name: string, output: SimplifierOutput): MeshData {
    return { name, positions: output.positions, normals: output.normals, uvs: output.uvs, indices: output.indices };
}
