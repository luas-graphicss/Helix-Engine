import type { Vec3 } from '@/engine/core/math/vec3';
const REGULARIZATION = 1e-6;
const MIN_SHARE_OF_EVEN_SPLIT = 0.05;
export function distributeSprungMass(mounts: readonly Vec3[], totalMass: number): number[] {
    const count = mounts.length;
    if (count === 0)
        return [];
    let sumX = 0;
    let sumZ = 0;
    let sumXX = REGULARIZATION;
    let sumZZ = REGULARIZATION;
    let sumXZ = 0;
    for (const mount of mounts) {
        sumX += mount[0];
        sumZ += mount[2];
        sumXX += mount[0] * mount[0];
        sumZZ += mount[2] * mount[2];
        sumXZ += mount[0] * mount[2];
    }
    const minorBase = sumXX * sumZZ - sumXZ * sumXZ;
    const minorX = sumXZ * sumZ - sumX * sumZZ;
    const minorZ = sumX * sumXZ - sumXX * sumZ;
    const determinant = count * minorBase + sumX * minorX + sumZ * minorZ;
    const floor = (totalMass / count) * MIN_SHARE_OF_EVEN_SPLIT;
    const masses = mounts.map((mount) => Math.max(floor, (totalMass * (minorBase + minorX * mount[0] + minorZ * mount[2])) / determinant));
    const assigned = masses.reduce((sum, mass) => sum + mass, 0);
    return masses.map((mass) => (mass * totalMass) / assigned);
}
