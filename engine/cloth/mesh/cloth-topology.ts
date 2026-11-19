import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
export interface ClothTopology {
    readonly particleCount: number;
    readonly vertexParticles: Uint32Array;
    readonly restPositions: Float32Array;
    readonly triangles: Uint32Array;
    readonly stretchPairs: Uint32Array;
    readonly bendPairs: Uint32Array;
}
interface WeldedVertices {
    readonly vertexParticles: Uint32Array;
    readonly restPositions: Float32Array;
}
interface ConstraintPairs {
    readonly stretchPairs: Uint32Array;
    readonly bendPairs: Uint32Array;
}
const WELD_RELATIVE_TOLERANCE = 1e-5;
const MIN_WELD_TOLERANCE = 1e-7;
function weldTolerance(positions: Float32Array): number {
    let min = Infinity;
    let max = -Infinity;
    for (const coordinate of positions) {
        if (coordinate < min)
            min = coordinate;
        if (coordinate > max)
            max = coordinate;
    }
    return Math.max((max - min) * WELD_RELATIVE_TOLERANCE, MIN_WELD_TOLERANCE);
}
function weldVertices(positions: Float32Array): WeldedVertices {
    const tolerance = weldTolerance(positions);
    const vertexCount = positions.length / 3;
    const vertexParticles = new Uint32Array(vertexCount);
    const particleByCell = new Map<string, number>();
    const restPositions: number[] = [];
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        const x = positions[vertex * 3];
        const y = positions[vertex * 3 + 1];
        const z = positions[vertex * 3 + 2];
        const cell = `${Math.round(x / tolerance)},${Math.round(y / tolerance)},${Math.round(z / tolerance)}`;
        let particle = particleByCell.get(cell);
        if (particle === undefined) {
            particle = restPositions.length / 3;
            particleByCell.set(cell, particle);
            restPositions.push(x, y, z);
        }
        vertexParticles[vertex] = particle;
    }
    return { vertexParticles, restPositions: new Float32Array(restPositions) };
}
function collectTriangles(indices: ArrayLike<number>, vertexParticles: Uint32Array): Uint32Array {
    const triangles: number[] = [];
    for (let corner = 0; corner + 2 < indices.length; corner += 3) {
        const a = vertexParticles[indices[corner]];
        const b = vertexParticles[indices[corner + 1]];
        const c = vertexParticles[indices[corner + 2]];
        if (a !== b && b !== c && a !== c)
            triangles.push(a, b, c);
    }
    return new Uint32Array(triangles);
}
function collectConstraintPairs(triangles: Uint32Array, particleCount: number): ConstraintPairs {
    const oppositeByEdge = new Map<number, number>();
    const stretchPairs: number[] = [];
    const bendPairs: number[] = [];
    const visitEdge = (first: number, second: number, opposite: number): void => {
        const low = Math.min(first, second);
        const high = Math.max(first, second);
        const edge = low * particleCount + high;
        const neighbor = oppositeByEdge.get(edge);
        if (neighbor === undefined) {
            oppositeByEdge.set(edge, opposite);
            stretchPairs.push(low, high);
            return;
        }
        if (neighbor !== opposite)
            bendPairs.push(neighbor, opposite);
    };
    for (let corner = 0; corner < triangles.length; corner += 3) {
        const a = triangles[corner];
        const b = triangles[corner + 1];
        const c = triangles[corner + 2];
        visitEdge(a, b, c);
        visitEdge(b, c, a);
        visitEdge(c, a, b);
    }
    return { stretchPairs: new Uint32Array(stretchPairs), bendPairs: new Uint32Array(bendPairs) };
}
export function buildClothTopology(mesh: MeshData): ClothTopology {
    const { vertexParticles, restPositions } = weldVertices(mesh.positions);
    const particleCount = restPositions.length / 3;
    const triangles = collectTriangles(mesh.indices, vertexParticles);
    const { stretchPairs, bendPairs } = collectConstraintPairs(triangles, particleCount);
    return { particleCount, vertexParticles, restPositions, triangles, stretchPairs, bendPairs };
}
