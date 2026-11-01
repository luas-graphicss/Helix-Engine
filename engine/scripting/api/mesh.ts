import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import type { Mat4 } from '@/engine/core/math/mat4';
import { Entity } from '@/engine/core/scene/entity';
import { createMeshData, getMeshVersion, getTriangleCount, getVertexCount, markMeshDirty, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createBox, createCapsule, createCone, createCylinder, createPlane, createRoundedBox, createSphere, createTorus } from '@/engine/renderer/geometry/primitives';
import { createDenseSphere, createEngravedTorus, createFlutedColumn, createRock, createTorusKnot } from '@/engine/renderer/geometry/dense-primitives';
import { mergeMeshData, transformMeshData } from '@/engine/renderer/geometry/mesh-transform';
import { raycastMesh } from '@/engine/renderer/geometry/mesh-raycast';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { simplifyByRatio, toMeshData } from '@/engine/renderer/lod/mesh-simplifier';
import { csgOperate, copyMeshData, type CsgOperation } from '@/engine/geometry/csg/csg-boolean';
import { brushTarget, collectBrushes } from '@/engine/geometry/csg/csg-system';
import { createCsgBrushSettings, createCsgSettings, CSG_OPERATIONS } from '@/engine/geometry/csg/csg-settings';
import { isMeshData } from '../runtime/engine-objects';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { optionalNumber, requireEntity, requireFunction, requireNumber, requireOneOf, toVec3 } from '../runtime/values';
const M = 'helix.mesh';
function requireMesh(value: unknown, member: string, what = 'a malha'): MeshData {
    if (value instanceof Entity) {
        if (!value.mesh)
            throw new HelixArgumentError(member, `${value.name} não tem malha.`);
        return value.mesh;
    }
    if (isMeshData(value))
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser um MeshData (helix.mesh.box(), entity.mesh…).`);
}
function toFloat32(value: unknown, member: string, what: string): Float32Array {
    if (value instanceof Float32Array)
        return value;
    if (Array.isArray(value))
        return new Float32Array(value as number[]);
    if (ArrayBuffer.isView(value))
        return new Float32Array(value as unknown as ArrayLike<number>);
    throw new HelixArgumentError(member, `${what} precisa ser um Float32Array ou um array de números.`);
}
export function computeNormals(mesh: MeshData): void {
    const { positions, normals, indices } = mesh;
    normals.fill(0);
    for (let index = 0; index < indices.length; index += 3) {
        const a = indices[index] * 3;
        const b = indices[index + 1] * 3;
        const c = indices[index + 2] * 3;
        const abx = positions[b] - positions[a];
        const aby = positions[b + 1] - positions[a + 1];
        const abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a];
        const acy = positions[c + 1] - positions[a + 1];
        const acz = positions[c + 2] - positions[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        for (const vertex of [a, b, c]) {
            normals[vertex] += nx;
            normals[vertex + 1] += ny;
            normals[vertex + 2] += nz;
        }
    }
    for (let index = 0; index < normals.length; index += 3) {
        const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1;
        normals[index] /= length;
        normals[index + 1] /= length;
        normals[index + 2] /= length;
    }
    markMeshDirty(mesh);
}
export function createMeshApi(host: RuntimeHost) {
    const n = (value: unknown, member: string, fallback: number, what = 'o valor') => optionalNumber(value, fallback, `${M}.${member}`, what);
    const meshApi = {
        box: (width?: unknown, height?: unknown, depth?: unknown, uvTileSize?: unknown) => createBox(n(width, 'box', 1, 'a largura'), n(height, 'box', 1, 'a altura'), n(depth, 'box', 1, 'a profundidade'), uvTileSize === undefined ? undefined : requireNumber(uvTileSize, `${M}.box`, 'o tamanho do ladrilho UV')),
        roundedBox: (width?: unknown, height?: unknown, depth?: unknown, radius?: unknown) => createRoundedBox(n(width, 'roundedBox', 1), n(height, 'roundedBox', 1), n(depth, 'roundedBox', 1), n(radius, 'roundedBox', 0.1, 'o raio')),
        plane: (width?: unknown, depth?: unknown, segments?: unknown) => createPlane(n(width, 'plane', 1), n(depth, 'plane', 1), Math.max(1, Math.floor(n(segments, 'plane', 1, 'os segmentos')))),
        sphere: (radius?: unknown, widthSegments?: unknown, heightSegments?: unknown) => createSphere(n(radius, 'sphere', 0.5, 'o raio'), Math.max(3, Math.floor(n(widthSegments, 'sphere', 32))), Math.max(2, Math.floor(n(heightSegments, 'sphere', 16)))),
        cylinder: (radius?: unknown, height?: unknown, radialSegments?: unknown) => createCylinder(n(radius, 'cylinder', 0.5, 'o raio'), n(height, 'cylinder', 1, 'a altura'), Math.max(3, Math.floor(n(radialSegments, 'cylinder', 32)))),
        cone: (radius?: unknown, height?: unknown, radialSegments?: unknown) => createCone(n(radius, 'cone', 0.5, 'o raio'), n(height, 'cone', 1, 'a altura'), Math.max(3, Math.floor(n(radialSegments, 'cone', 32)))),
        torus: (radius?: unknown, tube?: unknown, radialSegments?: unknown, tubularSegments?: unknown) => createTorus(n(radius, 'torus', 0.5, 'o raio'), n(tube, 'torus', 0.2, 'o raio do tubo'), Math.max(3, Math.floor(n(radialSegments, 'torus', 48))), Math.max(3, Math.floor(n(tubularSegments, 'torus', 24)))),
        capsule: (radius?: unknown, height?: unknown, radialSegments?: unknown, capSegments?: unknown) => createCapsule(n(radius, 'capsule', 0.25, 'o raio'), n(height, 'capsule', 0.5, 'a altura'), Math.max(3, Math.floor(n(radialSegments, 'capsule', 32))), Math.max(1, Math.floor(n(capSegments, 'capsule', 8)))),
        rock: (radius?: unknown, segments?: unknown, seed?: unknown) => createRock(n(radius, 'rock', 0.5, 'o raio'), Math.floor(n(segments, 'rock', 360)), Math.floor(n(seed, 'rock', 1, 'a semente'))),
        denseSphere: (radius?: unknown, segments?: unknown) => createDenseSphere(n(radius, 'denseSphere', 0.5, 'o raio'), Math.floor(n(segments, 'denseSphere', 320))),
        torusKnot: (radius?: unknown, tube?: unknown, p?: unknown, q?: unknown) => createTorusKnot(n(radius, 'torusKnot', 0.4, 'o raio'), n(tube, 'torusKnot', 0.12, 'o raio do tubo'), Math.floor(n(p, 'torusKnot', 2)), Math.floor(n(q, 'torusKnot', 3))),
        flutedColumn: (radius?: unknown, height?: unknown) => createFlutedColumn(n(radius, 'flutedColumn', 0.3, 'o raio'), n(height, 'flutedColumn', 1.4, 'a altura')),
        engravedTorus: (radius?: unknown, tube?: unknown) => createEngravedTorus(n(radius, 'engravedTorus', 0.5, 'o raio'), n(tube, 'engravedTorus', 0.2, 'o raio do tubo')),
        create: (options: unknown) => {
            const member = `${M}.create`;
            if (typeof options !== 'object' || options === null)
                throw new HelixArgumentError(member, 'esperava { positions, normals?, uvs?, indices?, name? }.');
            const spec = options as Record<string, unknown>;
            const positions = toFloat32(spec.positions, member, 'positions');
            if (positions.length % 3 !== 0 || positions.length === 0)
                throw new HelixArgumentError(member, `positions precisa de múltiplos de 3 números (recebido ${positions.length}).`);
            const vertexCount = positions.length / 3;
            const uvs = spec.uvs !== undefined ? toFloat32(spec.uvs, member, 'uvs') : new Float32Array(vertexCount * 2);
            if (uvs.length !== vertexCount * 2)
                throw new HelixArgumentError(member, `uvs precisa de ${vertexCount * 2} números (2 por vértice); recebido ${uvs.length}.`);
            let indices: ArrayLike<number>;
            if (spec.indices !== undefined) {
                if (!Array.isArray(spec.indices) && !ArrayBuffer.isView(spec.indices))
                    throw new HelixArgumentError(member, 'indices precisa ser um array de números.');
                indices = spec.indices as ArrayLike<number>;
                if (indices.length % 3 !== 0)
                    throw new HelixArgumentError(member, `indices precisa de múltiplos de 3 (recebido ${indices.length}).`);
                for (let index = 0; index < indices.length; index++) {
                    if (indices[index] < 0 || indices[index] >= vertexCount)
                        throw new HelixArgumentError(member, `índice ${indices[index]} fora dos ${vertexCount} vértices (posição ${index}).`);
                }
            }
            else {
                indices = Array.from({ length: vertexCount }, (_, index) => index);
            }
            const name = typeof spec.name === 'string' ? spec.name : 'Malha procedural';
            const mesh = createMeshData(name, positions, spec.normals !== undefined ? toFloat32(spec.normals, member, 'normals') : new Float32Array(vertexCount * 3), uvs, indices);
            if (spec.normals === undefined)
                computeNormals(mesh);
            if (spec.tangents === undefined)
                return mesh;
            const tangents = toFloat32(spec.tangents, member, 'tangents');
            if (tangents.length !== vertexCount * 4)
                throw new HelixArgumentError(member, `tangents precisa de ${vertexCount * 4} números (4 por vértice); recebido ${tangents.length}.`);
            return { ...mesh, tangents };
        },
        clone: (value: unknown, name?: unknown) => {
            const copy = copyMeshData(requireMesh(value, `${M}.clone`));
            return typeof name === 'string' ? { ...copy, name } : copy;
        },
        markDirty: (value: unknown) => markMeshDirty(requireMesh(value, `${M}.markDirty`)),
        version: (value: unknown) => getMeshVersion(requireMesh(value, `${M}.version`)),
        vertexCount: (value: unknown) => getVertexCount(requireMesh(value, `${M}.vertexCount`)),
        triangleCount: (value: unknown) => getTriangleCount(requireMesh(value, `${M}.triangleCount`)),
        computeNormals: (value: unknown) => {
            computeNormals(requireMesh(value, `${M}.computeNormals`));
        },
        computeBounds: (value: unknown) => {
            const bounds = getLocalBounds(requireMesh(value, `${M}.computeBounds`));
            return { min: vec3.copy(vec3.create(), bounds.min), max: vec3.copy(vec3.create(), bounds.max) };
        },
        flipWinding: (value: unknown) => {
            const mesh = requireMesh(value, `${M}.flipWinding`);
            const { indices, normals } = mesh;
            for (let index = 0; index < indices.length; index += 3) {
                const swap = indices[index + 1];
                indices[index + 1] = indices[index + 2];
                indices[index + 2] = swap;
            }
            for (let index = 0; index < normals.length; index++)
                normals[index] = -normals[index];
            markMeshDirty(mesh);
            return mesh;
        },
        merge: (...meshes: unknown[]) => {
            const list = (meshes.length === 1 && Array.isArray(meshes[0]) ? meshes[0] : meshes).map((entry: unknown) => requireMesh(entry, `${M}.merge`));
            if (list.length === 0)
                throw new HelixArgumentError(`${M}.merge`, 'esperava pelo menos uma malha.');
            return mergeMeshData(list[0].name, list);
        },
        transform: (value: unknown, matrix: unknown, name?: unknown) => {
            if (!(matrix instanceof Float32Array) || matrix.length !== 16)
                throw new HelixArgumentError(`${M}.transform`, 'esperava uma Mat4.');
            return transformMeshData(requireMesh(value, `${M}.transform`), matrix as Mat4, typeof name === 'string' ? name : undefined);
        },
        translate: (value: unknown, offset: unknown) => transformMeshData(requireMesh(value, `${M}.translate`), mat4.fromTranslationRotationScale(mat4.create(), toVec3(offset, `${M}.translate`), vec3.create(), vec3.create(1, 1, 1))),
        scale: (value: unknown, factor: unknown) => {
            const s = typeof factor === 'number' ? vec3.create(factor, factor, factor) : toVec3(factor, `${M}.scale`);
            return transformMeshData(requireMesh(value, `${M}.scale`), mat4.fromTranslationRotationScale(mat4.create(), vec3.create(), vec3.create(), s));
        },
        raycast: (rayValue: unknown, value: unknown, maxDistance?: unknown) => {
            const ray = rayValue as {
                origin?: unknown;
                direction?: unknown;
            };
            if (!ray || ray.origin === undefined || ray.direction === undefined)
                throw new HelixArgumentError(`${M}.raycast`, 'esperava um Ray ({ origin, direction }).');
            return raycastMesh({ origin: toVec3(ray.origin, `${M}.raycast`), direction: vec3.normalize(vec3.create(), toVec3(ray.direction, `${M}.raycast`)) }, requireMesh(value, `${M}.raycast`), maxDistance === undefined ? Infinity : requireNumber(maxDistance, `${M}.raycast`, 'a distância máxima'));
        },
        simplify: (value: unknown, ratio: unknown) => {
            const mesh = requireMesh(value, `${M}.simplify`);
            const r = requireNumber(ratio, `${M}.simplify`, 'a proporção (0..1)');
            return toMeshData(`${mesh.name} (simplificada)`, simplifyByRatio({ positions: mesh.positions, normals: mesh.normals, uvs: mesh.uvs, indices: mesh.indices }, r));
        },
        fromModelAsset: async (asset: unknown, nodeName?: unknown) => {
            const resolved = host.resolveAsset(asset, `${M}.fromModelAsset`, 'model');
            const imported = await host.session.library.loadModel(resolved);
            const wanted = typeof nodeName === 'string' ? nodeName : null;
            const meshes = imported.meshes.filter((entry) => !wanted || entry.name === wanted);
            if (meshes.length === 0)
                throw new HelixArgumentError(`${M}.fromModelAsset`, wanted ? `o modelo ${resolved.name} não tem a malha "${wanted}". Malhas: ${imported.meshes.map((entry) => entry.name).join(', ')}.` : `o modelo ${resolved.name} não tem malhas.`);
            const data = meshes.map((entry) => copyMeshData(entry.geometry, entry.name));
            return data.length === 1 ? data[0] : mergeMeshData(resolved.name, data);
        },
        toModelAsset: (value: unknown, name: unknown) => host.saveMeshAsset(requireMesh(value, `${M}.toModelAsset`), typeof name === 'string' && name ? name : 'Malha'),
        positions: (value: unknown) => requireMesh(value, `${M}.positions`).positions,
        normals: (value: unknown) => requireMesh(value, `${M}.normals`).normals,
        uvs: (value: unknown) => requireMesh(value, `${M}.uvs`).uvs,
        indices: (value: unknown) => requireMesh(value, `${M}.indices`).indices,
        forEachVertex: (value: unknown, visitor: unknown) => {
            const mesh = requireMesh(value, `${M}.forEachVertex`);
            const fn = requireFunction<(position: Float32Array, normal: Float32Array, uv: Float32Array, index: number) => void>(visitor, `${M}.forEachVertex`, 'o visitante');
            const count = getVertexCount(mesh);
            for (let index = 0; index < count; index++) {
                fn(mesh.positions.subarray(index * 3, index * 3 + 3), mesh.normals.subarray(index * 3, index * 3 + 3), mesh.uvs.subarray(index * 2, index * 2 + 2), index);
            }
            markMeshDirty(mesh);
        },
        lod: (value: unknown, settings?: unknown) => host.meshLod(requireEntity(value, `${M}.lod`), settings),
        myriad: (value: unknown, enabled?: unknown) => host.meshMyriad(requireEntity(value, `${M}.myriad`), enabled),
    };
    const csgApi = {
        operations: () => CSG_OPERATIONS.slice(),
        makeTarget: (value: unknown, options?: unknown) => {
            const entity = requireEntity(value, 'helix.csg.makeTarget');
            if (!entity.mesh)
                throw new HelixArgumentError('helix.csg.makeTarget', `${entity.name} não tem malha.`);
            if (!entity.csg)
                entity.csg = createCsgSettings(entity.mesh, (options ?? {}) as object);
            host.session.notify();
            return entity.csg;
        },
        makeBrush: (value: unknown, operation: unknown = 'subtract', enabled: unknown = true) => {
            const entity = requireEntity(value, 'helix.csg.makeBrush');
            if (!entity.parent?.csg)
                throw new HelixArgumentError('helix.csg.makeBrush', `${entity.name} precisa ser filho de um alvo CSG (helix.csg.makeTarget no pai).`);
            entity.csgBrush = createCsgBrushSettings(requireOneOf(operation, CSG_OPERATIONS, 'helix.csg.makeBrush', 'a operação') as CsgOperation, Boolean(enabled));
            host.session.csg.invalidate(entity.parent);
            host.session.notify();
            return entity.csgBrush;
        },
        rebuild: (value: unknown) => {
            const entity = requireEntity(value, 'helix.csg.rebuild');
            const target = entity.csg ? entity : brushTarget(entity);
            if (!target)
                throw new HelixArgumentError('helix.csg.rebuild', `${entity.name} não é alvo nem pincel CSG.`);
            host.session.csg.rebuildNow(host.session.scene, target);
        },
        invalidate: (value: unknown) => {
            const entity = requireEntity(value, 'helix.csg.invalidate');
            const target = entity.csg ? entity : brushTarget(entity);
            if (target)
                host.session.csg.invalidate(target);
        },
        stats: (value: unknown) => host.session.csg.statsOf(requireEntity(value, 'helix.csg.stats')),
        onRebuilt: (handler: unknown) => {
            const fn = requireFunction<(entity: Entity) => void>(handler, 'helix.csg.onRebuilt');
            const owner = host.current;
            const dispose = host.session.csg.onRebuilt((entity) => host.invoke(owner, 'helix.csg.onRebuilt', () => fn(entity)));
            owner?.track(dispose);
            return dispose;
        },
        collectBrushes: (value: unknown) => collectBrushes(requireEntity(value, 'helix.csg.collectBrushes')),
        brushTarget: (value: unknown) => brushTarget(requireEntity(value, 'helix.csg.brushTarget')),
        boolean: (a: unknown, b: unknown, operation: unknown, brushMatrix?: unknown, exact?: unknown) => {
            const target = requireMesh(a, 'helix.csg.boolean', 'a malha alvo');
            const brush = requireMesh(b, 'helix.csg.boolean', 'a malha pincel');
            const op = requireOneOf(operation, CSG_OPERATIONS, 'helix.csg.boolean', 'a operação') as CsgOperation;
            const matrix = brushMatrix instanceof Float32Array && brushMatrix.length === 16 ? (brushMatrix as Mat4) : mat4.identity(mat4.create());
            return csgOperate(op, copyMeshData(target), brush, matrix, undefined, Boolean(exact));
        },
        sourceMesh: (value: unknown) => requireEntity(value, 'helix.csg.sourceMesh').csg?.sourceMesh ?? null,
    };
    return { mesh: meshApi, csg: csgApi };
}
export { aabb };
