import * as aabb from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { ClothCollider } from '@/engine/cloth/collision/cloth-collider';
import { resolveParticleCollision, type ContactMaterial } from '@/engine/cloth/collision/particle-collision';
import { applyAerodynamics, type ClothAir } from '@/engine/cloth/forces/cloth-aerodynamics';
import { createClothState, type ClothState } from './cloth-state';
import { createDistanceConstraints, solveDistanceConstraints, type DistanceConstraints } from './distance-constraints';
import type { ClothSolverParameters } from './solver-parameters';
import { createTetherConstraints, solveTetherConstraints, type TetherConstraints } from './tether-constraints';
interface ClothEnvironment {
    readonly gravity: Vec3;
    readonly air: ClothAir;
    readonly colliders: readonly ClothCollider[];
    readonly time: number;
}
const MAX_PARTICLE_SPEED = 60;
const COLLIDER_SEARCH_MARGIN = 0.5;
export class ClothSolver {
    readonly state: ClothState;
    private readonly stretch: DistanceConstraints;
    private readonly bend: DistanceConstraints;
    private readonly restPositions: Float32Array;
    private tethers: TetherConstraints;
    private readonly reach = aabb.create();
    private readonly nearbyColliders: ClothCollider[] = [];
    constructor(positions: Float32Array, private readonly triangles: Uint32Array, stretchPairs: Uint32Array, bendPairs: Uint32Array) {
        this.state = createClothState(positions);
        this.stretch = createDistanceConstraints(stretchPairs, positions);
        this.bend = createDistanceConstraints(bendPairs, positions);
        this.restPositions = new Float32Array(positions);
        this.tethers = createTetherConstraints(this.restPositions, new Uint8Array(this.state.particleCount));
    }
    get constraintCount(): number {
        return this.stretch.restLengths.length + this.bend.restLengths.length;
    }
    tetherTo(anchored: Uint8Array): void {
        this.tethers = createTetherConstraints(this.restPositions, anchored);
    }
    step(stepSeconds: number, parameters: ClothSolverParameters, environment: ClothEnvironment, anchorTargets: Float32Array): void {
        const { substeps } = parameters;
        const substepSeconds = stepSeconds / substeps;
        const stretchCompliance = parameters.stretchCompliance / substepSeconds ** 2;
        const bendCompliance = parameters.bendCompliance / substepSeconds ** 2;
        const velocityRetention = Math.exp(-parameters.dampingRate * substepSeconds);
        const colliders = this.findNearbyColliders(environment.colliders, parameters.thickness);
        applyAerodynamics(this.state, this.triangles, environment.air, environment.time, stepSeconds);
        for (let substep = 0; substep < substeps; substep++) {
            this.integrate(substepSeconds, environment.gravity, anchorTargets, substeps - substep);
            solveDistanceConstraints(this.state, this.bend, bendCompliance);
            solveDistanceConstraints(this.state, this.stretch, stretchCompliance);
            solveTetherConstraints(this.state.positions, this.tethers, parameters.tetherSlack);
            this.collide(colliders, parameters);
            this.deriveVelocities(substepSeconds, velocityRetention);
        }
    }
    private findNearbyColliders(colliders: readonly ClothCollider[], thickness: number): readonly ClothCollider[] {
        const { reach, nearbyColliders } = this;
        nearbyColliders.length = 0;
        if (colliders.length === 0)
            return nearbyColliders;
        const { positions } = this.state;
        const margin = thickness + COLLIDER_SEARCH_MARGIN;
        aabb.reset(reach);
        for (let offset = 0; offset < positions.length; offset += 3) {
            for (let axis = 0; axis < 3; axis++) {
                const coordinate = positions[offset + axis];
                if (coordinate - margin < reach.min[axis])
                    reach.min[axis] = coordinate - margin;
                if (coordinate + margin > reach.max[axis])
                    reach.max[axis] = coordinate + margin;
            }
        }
        for (const collider of colliders) {
            if (aabb.intersects(reach, collider.bounds))
                nearbyColliders.push(collider);
        }
        return nearbyColliders;
    }
    private integrate(seconds: number, gravity: Vec3, anchorTargets: Float32Array, remainingSubsteps: number): void {
        const { positions, previousPositions, velocities, inverseMasses, particleCount } = this.state;
        for (let particle = 0; particle < particleCount; particle++) {
            const anchored = inverseMasses[particle] === 0;
            for (let axis = 0; axis < 3; axis++) {
                const offset = particle * 3 + axis;
                previousPositions[offset] = positions[offset];
                if (anchored) {
                    positions[offset] += (anchorTargets[offset] - positions[offset]) / remainingSubsteps;
                    continue;
                }
                velocities[offset] += gravity[axis] * seconds;
                positions[offset] += velocities[offset] * seconds;
            }
        }
    }
    private collide(colliders: readonly ClothCollider[], material: ContactMaterial): void {
        if (colliders.length === 0)
            return;
        const { state } = this;
        const { inverseMasses, particleCount } = state;
        for (let particle = 0; particle < particleCount; particle++) {
            if (inverseMasses[particle] === 0)
                continue;
            for (let index = 0; index < colliders.length; index++)
                resolveParticleCollision(colliders[index], state, particle * 3, material);
        }
    }
    private deriveVelocities(seconds: number, retention: number): void {
        const { positions, previousPositions, velocities } = this.state;
        const scale = retention / seconds;
        for (let offset = 0; offset < positions.length; offset += 3) {
            const vx = (positions[offset] - previousPositions[offset]) * scale;
            const vy = (positions[offset + 1] - previousPositions[offset + 1]) * scale;
            const vz = (positions[offset + 2] - previousPositions[offset + 2]) * scale;
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            const limit = speed > MAX_PARTICLE_SPEED ? MAX_PARTICLE_SPEED / speed : 1;
            velocities[offset] = vx * limit;
            velocities[offset + 1] = vy * limit;
            velocities[offset + 2] = vz * limit;
        }
    }
}
