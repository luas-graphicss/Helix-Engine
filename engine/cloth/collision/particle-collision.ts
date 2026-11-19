import type { BoxCollider, CapsuleCollider, ClothCollider, HeightfieldCollider } from './cloth-collider';
export interface ContactMaterial {
    readonly thickness: number;
    readonly friction: number;
}
interface ParticleMotion {
    readonly positions: Float32Array;
    readonly previousPositions: Float32Array;
}
const MIN_DISTANCE = 1e-9;
function pushAlong(motion: ParticleMotion, offset: number, nx: number, ny: number, nz: number, depth: number, friction: number): void {
    const { positions, previousPositions } = motion;
    positions[offset] += nx * depth;
    positions[offset + 1] += ny * depth;
    positions[offset + 2] += nz * depth;
    const travelX = positions[offset] - previousPositions[offset];
    const travelY = positions[offset + 1] - previousPositions[offset + 1];
    const travelZ = positions[offset + 2] - previousPositions[offset + 2];
    const normalTravel = travelX * nx + travelY * ny + travelZ * nz;
    positions[offset] -= (travelX - normalTravel * nx) * friction;
    positions[offset + 1] -= (travelY - normalTravel * ny) * friction;
    positions[offset + 2] -= (travelZ - normalTravel * nz) * friction;
}
function separateFromPoint(motion: ParticleMotion, offset: number, x: number, y: number, z: number, reach: number, friction: number): void {
    const { positions } = motion;
    const dx = positions[offset] - x;
    const dy = positions[offset + 1] - y;
    const dz = positions[offset + 2] - z;
    const squaredDistance = dx * dx + dy * dy + dz * dz;
    if (squaredDistance >= reach * reach)
        return;
    const distance = Math.sqrt(squaredDistance);
    if (distance < MIN_DISTANCE) {
        pushAlong(motion, offset, 0, 1, 0, reach, friction);
        return;
    }
    pushAlong(motion, offset, dx / distance, dy / distance, dz / distance, reach - distance, friction);
}
function separateFromCapsule(collider: CapsuleCollider, motion: ParticleMotion, offset: number, material: ContactMaterial): void {
    const { start, end } = collider;
    const { positions } = motion;
    const axisX = end[0] - start[0];
    const axisY = end[1] - start[1];
    const axisZ = end[2] - start[2];
    const squaredLength = axisX * axisX + axisY * axisY + axisZ * axisZ;
    const projection = (positions[offset] - start[0]) * axisX + (positions[offset + 1] - start[1]) * axisY + (positions[offset + 2] - start[2]) * axisZ;
    const along = squaredLength > 0 ? Math.min(Math.max(projection / squaredLength, 0), 1) : 0;
    separateFromPoint(motion, offset, start[0] + axisX * along, start[1] + axisY * along, start[2] + axisZ * along, collider.radius + material.thickness, material.friction);
}
function separateFromBox(collider: BoxCollider, motion: ParticleMotion, offset: number, material: ContactMaterial): void {
    const { center, axes, halfExtents } = collider;
    const { positions } = motion;
    const dx = positions[offset] - center[0];
    const dy = positions[offset + 1] - center[1];
    const dz = positions[offset + 2] - center[2];
    let shallowestDepth = Infinity;
    let exitAxis = 0;
    let exitSide = 1;
    for (let axis = 0; axis < 3; axis++) {
        const along = dx * axes[axis * 3] + dy * axes[axis * 3 + 1] + dz * axes[axis * 3 + 2];
        const depth = halfExtents[axis] + material.thickness - Math.abs(along);
        if (depth <= 0)
            return;
        if (depth < shallowestDepth) {
            shallowestDepth = depth;
            exitAxis = axis;
            exitSide = along < 0 ? -1 : 1;
        }
    }
    pushAlong(motion, offset, axes[exitAxis * 3] * exitSide, axes[exitAxis * 3 + 1] * exitSide, axes[exitAxis * 3 + 2] * exitSide, shallowestDepth, material.friction);
}
function separateFromHeightfield(collider: HeightfieldCollider, motion: ParticleMotion, offset: number, material: ContactMaterial): void {
    const { positions } = motion;
    const surface = collider.heightAt(positions[offset], positions[offset + 2]) + material.thickness;
    if (positions[offset + 1] < surface)
        pushAlong(motion, offset, 0, 1, 0, surface - positions[offset + 1], material.friction);
}
export function resolveParticleCollision(collider: ClothCollider, motion: ParticleMotion, offset: number, material: ContactMaterial): void {
    switch (collider.kind) {
        case 'sphere':
            separateFromPoint(motion, offset, collider.center[0], collider.center[1], collider.center[2], collider.radius + material.thickness, material.friction);
            return;
        case 'capsule':
            separateFromCapsule(collider, motion, offset, material);
            return;
        case 'box':
            separateFromBox(collider, motion, offset, material);
            return;
        case 'heightfield':
            separateFromHeightfield(collider, motion, offset, material);
            return;
    }
}
