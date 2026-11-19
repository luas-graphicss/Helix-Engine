export interface ClothState {
    readonly particleCount: number;
    readonly positions: Float32Array;
    readonly previousPositions: Float32Array;
    readonly velocities: Float32Array;
    readonly inverseMasses: Float32Array;
}
export function createClothState(positions: Float32Array): ClothState {
    const particleCount = positions.length / 3;
    return {
        particleCount,
        positions,
        previousPositions: new Float32Array(positions),
        velocities: new Float32Array(positions.length),
        inverseMasses: new Float32Array(particleCount),
    };
}
