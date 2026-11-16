import * as aabb from '@/engine/core/math/aabb';
import { intersectRayAabb, type Ray } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { createIndexArray, getTriangleCount, getVertexCount, markMeshDirty, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { raycastMesh } from '@/engine/renderer/geometry/mesh-raycast';
import { createBox, createCapsule, createCone, createCylinder, createPlane, createRoundedBox, createSphere, createTorus } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const TOLERANCE = 1e-4;
const UNIT_NORMAL_TOLERANCE = 1e-3;
const DEGENERATE_AREA = 1e-10;
const BOX_TRIANGLES = 12;
const UINT16_VERTEX_LIMIT = 0xffff;
const checks = createCheckList('Primitivas e malhas');
interface Sample {
    name: string;
    mesh: MeshData;
    convex: boolean;
}
const SAMPLES: Sample[] = [
    { name: 'caixa', mesh: createBox(2, 4, 6), convex: true },
    { name: 'caixa arredondada', mesh: createRoundedBox(2, 2, 2, 0.25), convex: true },
    { name: 'plano', mesh: createPlane(4, 6, 3), convex: false },
    { name: 'esfera', mesh: createSphere(0.5), convex: true },
    { name: 'cilindro', mesh: createCylinder(0.5, 2), convex: true },
    { name: 'cone', mesh: createCone(0.5, 2), convex: true },
    { name: 'toro', mesh: createTorus(0.5, 0.2), convex: false },
    { name: 'cápsula', mesh: createCapsule(0.25, 0.5), convex: true },
];
function vertex(values: Float32Array, index: number): vec3.Vec3 {
    return vec3.create(values[index * 3], values[index * 3 + 1], values[index * 3 + 2]);
}
function hasCoherentBuffers(mesh: MeshData): boolean {
    const vertexCount = getVertexCount(mesh);
    return Number.isInteger(vertexCount) && vertexCount > 0
        && mesh.normals.length === vertexCount * 3
        && mesh.uvs.length === vertexCount * 2
        && mesh.indices.length > 0
        && mesh.indices.length % 3 === 0;
}
function hasValidIndices(mesh: MeshData): boolean {
    const vertexCount = getVertexCount(mesh);
    return mesh.indices.every((index) => index < vertexCount);
}
function hasFiniteValues(mesh: MeshData): boolean {
    return mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite) && mesh.uvs.every(Number.isFinite);
}
function hasUnitNormals(mesh: MeshData): boolean {
    for (let index = 0; index < getVertexCount(mesh); index++) {
        if (Math.abs(vec3.length(vertex(mesh.normals, index)) - 1) > UNIT_NORMAL_TOLERANCE)
            return false;
    }
    return true;
}
function everyFace(mesh: MeshData, accepts: (faceNormal: vec3.Vec3, corners: [number, number, number]) => boolean): boolean {
    const edgeA = vec3.create();
    const edgeB = vec3.create();
    const faceNormal = vec3.create();
    for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const corners: [number, number, number] = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
        const origin = vertex(mesh.positions, corners[0]);
        vec3.subtract(edgeA, vertex(mesh.positions, corners[1]), origin);
        vec3.subtract(edgeB, vertex(mesh.positions, corners[2]), origin);
        vec3.cross(faceNormal, edgeA, edgeB);
        if (vec3.length(faceNormal) < DEGENERATE_AREA)
            continue;
        if (!accepts(faceNormal, corners))
            return false;
    }
    return true;
}
function vertexNormalsFollowWinding(mesh: MeshData): boolean {
    const averaged = vec3.create();
    return everyFace(mesh, (faceNormal, corners) => {
        vec3.set(averaged, 0, 0, 0);
        for (const corner of corners)
            vec3.add(averaged, averaged, vertex(mesh.normals, corner));
        return vec3.dot(faceNormal, averaged) > 0;
    });
}
function facesPointAwayFromCenter(mesh: MeshData): boolean {
    const center = aabb.center(vec3.create(), getLocalBounds(mesh));
    const centroid = vec3.create();
    return everyFace(mesh, (faceNormal, corners) => {
        vec3.set(centroid, 0, 0, 0);
        for (const corner of corners)
            vec3.scaleAndAdd(centroid, centroid, vertex(mesh.positions, corner), 1 / 3);
        return vec3.dot(faceNormal, vec3.subtract(centroid, centroid, center)) > 0;
    });
}
function structure(): void {
    for (const { name, mesh, convex } of SAMPLES) {
        checks.check(`${name}: os buffers têm tamanhos coerentes`, hasCoherentBuffers(mesh));
        checks.check(`${name}: os índices apontam para vértices que existem`, hasValidIndices(mesh));
        checks.check(`${name}: posições, normais e UVs são finitos`, hasFiniteValues(mesh));
        checks.check(`${name}: as normais têm norma um`, hasUnitNormals(mesh));
        checks.check(`${name}: as normais dos vértices ficam do lado para onde a face aponta`, vertexNormalsFollowWinding(mesh));
        if (convex)
            checks.check(`${name}: as faces apontam para fora do sólido`, facesPointAwayFromCenter(mesh));
    }
}
function bounds(): void {
    const box = getLocalBounds(createBox(2, 4, 6));
    const sphere = getLocalBounds(createSphere(0.5));
    const plane = getLocalBounds(createPlane(4, 6));
    checks.nearAll('a caixa fica centrada na origem com as dimensões pedidas (mínimo)', box.min, [-1, -2, -3], TOLERANCE);
    checks.nearAll('a caixa fica centrada na origem com as dimensões pedidas (máximo)', box.max, [1, 2, 3], TOLERANCE);
    checks.nearAll('a esfera alcança o raio pedido nos três eixos (mínimo)', sphere.min, [-0.5, -0.5, -0.5], TOLERANCE);
    checks.nearAll('a esfera alcança o raio pedido nos três eixos (máximo)', sphere.max, [0.5, 0.5, 0.5], TOLERANCE);
    checks.nearAll('o plano fica deitado em Y = 0 (mínimo)', plane.min, [-2, 0, -3], TOLERANCE);
    checks.nearAll('o plano fica deitado em Y = 0 (máximo)', plane.max, [2, 0, 3], TOLERANCE);
}
function raycasts(): void {
    const mesh = createBox(2, 2, 2);
    const fromFront: Ray = { origin: vec3.create(0, 0, 5), direction: vec3.create(0, 0, -1) };
    const away: Ray = { origin: vec3.create(0, 0, 5), direction: vec3.create(0, 0, 1) };
    const fromInside: Ray = { origin: vec3.create(), direction: vec3.create(1, 0, 0) };
    checks.near('raycastMesh acerta a face da frente da caixa', raycastMesh(fromFront, mesh) ?? Number.NaN, 4, TOLERANCE);
    checks.near('raycastMesh concorda com o raio contra a caixa envolvente', raycastMesh(fromFront, mesh) ?? Number.NaN, intersectRayAabb(fromFront, getLocalBounds(mesh)) ?? Number.NaN, TOLERANCE);
    checks.near('raycastMesh acerta por trás a face vista de dentro', raycastMesh(fromInside, mesh) ?? Number.NaN, 1, TOLERANCE);
    checks.check('raycastMesh não acerta quando o raio se afasta', raycastMesh(away, mesh) === null);
    checks.check('raycastMesh respeita a distância máxima', raycastMesh(fromFront, mesh, 3) === null);
}
function meshData(): void {
    const mesh = createBox(2, 2, 2);
    const before = getLocalBounds(mesh).min[0];
    mesh.positions[0] = -5;
    const cached = getLocalBounds(mesh).min[0];
    markMeshDirty(mesh);
    const refreshed = getLocalBounds(mesh).min[0];
    checks.check('a caixa tem doze triângulos', getTriangleCount(createBox()) === BOX_TRIANGLES);
    checks.check('createIndexArray usa 16 bits enquanto os vértices cabem', createIndexArray([0, 1, 2], UINT16_VERTEX_LIMIT) instanceof Uint16Array);
    checks.check('createIndexArray passa a 32 bits acima de 65535 vértices', createIndexArray([0, 1, 70000], UINT16_VERTEX_LIMIT + 1)[2] === 70000);
    checks.check('getLocalBounds mantém o resultado em cache até a malha ser marcada', before === -1 && cached === -1);
    checks.check('getLocalBounds recalcula depois de markMeshDirty', refreshed === -5);
}
structure();
bounds();
raycasts();
meshData();
checks.finish();
