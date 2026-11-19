import type { ClothState } from './cloth-state';
export interface DistanceConstraints {
    readonly pairs: Uint32Array;
    readonly restLengths: Float32Array;
}
const MIN_LENGTH = 1e-9;
export function createDistanceConstraints(pairs: Uint32Array, positions: Float32Array): DistanceConstraints {
    const restLengths = new Float32Array(pairs.length / 2);
    for (let constraint = 0; constraint < restLengths.length; constraint++) {
        const a = pairs[constraint * 2] * 3;
        const b = pairs[constraint * 2 + 1] * 3;
        restLengths[constraint] = Math.hypot(positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]);
    }
    return { pairs, restLengths };
}
export function solveDistanceConstraints(state: ClothState, constraints: DistanceConstraints, scaledCompliance: number): void {
    const { positions, inverseMasses } = state;
    const { pairs, restLengths } = constraints;
    for (let constraint = 0; constraint < restLengths.length; constraint++) {
        const first = pairs[constraint * 2];
        const second = pairs[constraint * 2 + 1];
        const firstWeight = inverseMasses[first];
        const secondWeight = inverseMasses[second];
        const weight = firstWeight + secondWeight;
        if (weight === 0)
            continue;
        const a = first * 3;
        const b = second * 3;
        const dx = positions[b] - positions[a];
        const dy = positions[b + 1] - positions[a + 1];
        const dz = positions[b + 2] - positions[a + 2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < MIN_LENGTH)
            continue;
        const correction = (length - restLengths[constraint]) / (length * (weight + scaledCompliance));
        positions[a] += dx * correction * firstWeight;
        positions[a + 1] += dy * correction * firstWeight;
        positions[a + 2] += dz * correction * firstWeight;
        positions[b] -= dx * correction * secondWeight;
        positions[b + 1] -= dy * correction * secondWeight;
        positions[b + 2] -= dz * correction * secondWeight;
    }
}
