import * as mat4 from '@/engine/core/math/mat4';
import { degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { markMeshDirty, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { selectAnchoredParticles } from '@/engine/cloth/anchor/cloth-anchors';
import type { ClothSettings } from '@/engine/cloth/cloth-settings';
import type { ClothCollider } from '@/engine/cloth/collision/cloth-collider';
import type { ClothAir } from '@/engine/cloth/forces/cloth-aerodynamics';
import { computeParticleNormals } from '@/engine/cloth/mesh/cloth-normals';
import { buildClothTopology, type ClothTopology } from '@/engine/cloth/mesh/cloth-topology';
import { transformPoints } from '@/engine/cloth/mesh/transform-points';
import { ClothSolver } from '@/engine/cloth/solver/cloth-solver';
import { assignInverseMasses, averageInverseMass, computeAreaShares } from '@/engine/cloth/solver/particle-masses';
import { createSolverParameters, type ClothSolverParameters } from '@/engine/cloth/solver/solver-parameters';
import { trackSimulatedMesh } from './cloth-rest-meshes';
interface ClothSurroundings {
    readonly gravity: Vec3;
    readonly colliders: readonly ClothCollider[];
    readonly time: number;
}
interface ClothTuning {
    readonly settings: ClothSettings;
    readonly parameters: ClothSolverParameters;
    readonly air: ClothAir;
    readonly anchoredCount: number;
}
const NO_COLLIDERS: readonly ClothCollider[] = [];
function createSimulatedMesh(rest: MeshData): MeshData {
    return {
        name: rest.name,
        positions: new Float32Array(rest.positions),
        normals: new Float32Array(rest.normals),
        uvs: rest.uvs,
        indices: rest.indices,
        dynamic: true,
    };
}
function createAir(settings: ClothSettings): ClothAir {
    const heading = degToRad(settings.windDirection);
    return {
        windX: Math.cos(heading) * settings.windSpeed,
        windY: 0,
        windZ: Math.sin(heading) * settings.windSpeed,
        turbulence: settings.windTurbulence,
        drag: settings.airDrag,
    };
}
export class ClothInstance {
    readonly mesh: MeshData;
    private readonly topology: ClothTopology;
    private readonly solver: ClothSolver;
    private readonly areaShares: Float32Array;
    private readonly anchorTargets: Float32Array;
    private readonly localPositions: Float32Array;
    private readonly localNormals: Float32Array;
    private readonly inverseWorld = mat4.create();
    private readonly gravity = vec3.create();
    private tuning: ClothTuning;
    constructor(readonly entity: Entity, readonly restMesh: MeshData, settings: ClothSettings) {
        const topology = buildClothTopology(restMesh);
        const worldPositions = new Float32Array(topology.restPositions.length);
        transformPoints(worldPositions, entity.worldMatrix, topology.restPositions);
        this.topology = topology;
        this.solver = new ClothSolver(worldPositions, topology.triangles, topology.stretchPairs, topology.bendPairs);
        this.areaShares = computeAreaShares(worldPositions, topology.triangles);
        this.anchorTargets = new Float32Array(worldPositions);
        this.localPositions = new Float32Array(topology.restPositions);
        this.localNormals = new Float32Array(topology.restPositions.length);
        this.mesh = createSimulatedMesh(restMesh);
        trackSimulatedMesh(this.mesh, restMesh);
        entity.mesh = this.mesh;
        this.tuning = this.tune(settings);
    }
    get settings(): ClothSettings {
        return this.tuning.settings;
    }
    get particleCount(): number {
        return this.topology.particleCount;
    }
    get anchoredCount(): number {
        return this.tuning.anchoredCount;
    }
    get constraintCount(): number {
        return this.solver.constraintCount;
    }
    applySettings(settings: ClothSettings): void {
        this.tuning = this.tune(settings);
    }
    step(stepSeconds: number, surroundings: ClothSurroundings): void {
        const { settings, parameters, air } = this.tuning;
        transformPoints(this.anchorTargets, this.entity.worldMatrix, this.topology.restPositions);
        vec3.scale(this.gravity, surroundings.gravity, settings.gravityScale);
        this.solver.step(stepSeconds, parameters, {
            gravity: this.gravity,
            air,
            colliders: settings.collideWithBodies ? surroundings.colliders : NO_COLLIDERS,
            time: surroundings.time,
        }, this.anchorTargets);
    }
    writeMesh(): void {
        if (!mat4.invert(this.inverseWorld, this.entity.worldMatrix))
            return;
        const { localPositions, localNormals, mesh } = this;
        const { vertexParticles, triangles } = this.topology;
        transformPoints(localPositions, this.inverseWorld, this.solver.state.positions);
        computeParticleNormals(localNormals, localPositions, triangles);
        for (let vertex = 0; vertex < vertexParticles.length; vertex++) {
            const source = vertexParticles[vertex] * 3;
            const target = vertex * 3;
            for (let axis = 0; axis < 3; axis++) {
                mesh.positions[target + axis] = localPositions[source + axis];
                mesh.normals[target + axis] = localNormals[source + axis];
            }
        }
        markMeshDirty(mesh);
    }
    dispose(): void {
        if (this.entity.mesh === this.mesh)
            this.entity.mesh = this.restMesh;
    }
    private tune(settings: ClothSettings): ClothTuning {
        const { inverseMasses } = this.solver.state;
        const anchored = selectAnchoredParticles(this.topology.restPositions, settings.anchor, settings.anchorBand);
        assignInverseMasses(inverseMasses, this.areaShares, settings.density, anchored);
        this.solver.tetherTo(anchored);
        let anchoredCount = 0;
        for (const flag of anchored)
            anchoredCount += flag;
        return {
            settings,
            parameters: createSolverParameters(settings, averageInverseMass(inverseMasses)),
            air: createAir(settings),
            anchoredCount,
        };
    }
}
