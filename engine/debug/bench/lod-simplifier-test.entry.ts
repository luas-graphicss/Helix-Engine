import { createDenseSphere } from '@/engine/renderer/geometry/dense-primitives';
import { createMeshData, getTriangleCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { mergeMeshData, transformMeshData } from '@/engine/renderer/geometry/mesh-transform';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { simplifyToTriangles, type SimplifierState } from '@/engine/renderer/lod/mesh-simplifier';
import { computePositionIds } from '@/engine/renderer/myriad/build/vertex-welding';
interface Topology {
    components: number;
    euler: number[];
    borderEdges: number;
    triangles: number;
}
function analyze(mesh: MeshData): Topology {
    const positionIds = computePositionIds(mesh.positions);
    let positionCount = 0;
    for (let i = 0; i < positionIds.length; i++)
        positionCount = Math.max(positionCount, positionIds[i] + 1);
    const parent = new Int32Array(positionCount);
    for (let p = 0; p < positionCount; p++)
        parent[p] = p;
    const find = (p: number): number => {
        while (parent[p] !== p) {
            parent[p] = parent[parent[p]];
            p = parent[p];
        }
        return p;
    };
    const union = (a: number, b: number) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb)
            parent[ra] = rb;
    };
    const { indices } = mesh;
    const faceIds: number[] = [];
    for (let t = 0; t < indices.length / 3; t++) {
        const a = positionIds[indices[t * 3]], b = positionIds[indices[t * 3 + 1]], c = positionIds[indices[t * 3 + 2]];
        if (a === b || b === c || a === c)
            continue;
        faceIds.push(a, b, c);
    }
    const triangles = faceIds.length / 3;
    const edgeTriangles = new Map<number, number>();
    for (let t = 0; t < triangles; t++) {
        for (let k = 0; k < 3; k++) {
            const a = faceIds[t * 3 + k], b = faceIds[t * 3 + ((k + 1) % 3)];
            union(a, b);
            const key = a < b ? a * positionCount + b : b * positionCount + a;
            edgeTriangles.set(key, (edgeTriangles.get(key) ?? 0) + 1);
        }
    }
    const vertices = new Map<number, number>();
    const edges = new Map<number, number>();
    const faces = new Map<number, number>();
    const used = new Uint8Array(positionCount);
    for (let t = 0; t < triangles; t++) {
        const root = find(faceIds[t * 3]);
        faces.set(root, (faces.get(root) ?? 0) + 1);
        for (let k = 0; k < 3; k++)
            used[faceIds[t * 3 + k]] = 1;
    }
    for (let p = 0; p < positionCount; p++) {
        if (!used[p])
            continue;
        const root = find(p);
        vertices.set(root, (vertices.get(root) ?? 0) + 1);
    }
    let borderEdges = 0;
    for (const [key, count] of edgeTriangles) {
        const a = Math.floor(key / positionCount);
        const root = find(a);
        edges.set(root, (edges.get(root) ?? 0) + 1);
        if (count === 1)
            borderEdges++;
    }
    const euler: number[] = [];
    for (const [root, f] of faces)
        euler.push((vertices.get(root) ?? 0) - (edges.get(root) ?? 0) + f);
    euler.sort((a, b) => a - b);
    return { components: faces.size, euler, borderEdges, triangles };
}
function createStrip(width: number, length: number, segments: number): MeshData {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let s = 0; s <= segments; s++) {
        const y = (s / segments) * length;
        const z = Math.sin((s / segments) * Math.PI) * 0.02;
        for (let side = 0; side < 2; side++) {
            positions.push((side - 0.5) * width, y, z);
            normals.push(0, 0, 1);
            uvs.push(side, s / segments);
        }
    }
    for (let s = 0; s < segments; s++) {
        const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, c, b, b, c, d);
    }
    return createMeshData('strip', positions, normals, uvs, indices);
}
function sameTopology(a: Topology, b: Topology): boolean {
    if (a.components !== b.components || a.euler.length !== b.euler.length)
        return false;
    if (a.borderEdges === 0 && b.borderEdges !== 0)
        return false;
    for (let i = 0; i < a.euler.length; i++)
        if (a.euler[i] !== b.euler[i])
            return false;
    return true;
}
let failures = 0;
function check(condition: boolean, message: string): void {
    if (!condition) {
        failures++;
        console.error(`  FALHOU: ${message}`);
    }
}
function runChain(name: string, source: MeshData, levels: number): void {
    console.log(`\n${name}: ${getTriangleCount(source)} triângulos`);
    const base = analyze(source);
    console.log(`  original: ${base.components} componentes, χ = [${base.euler.slice(0, 6).join(', ')}${base.euler.length > 6 ? ', …' : ''}], ${base.borderEdges} arestas de borda`);
    let current: MeshData = source;
    let state: SimplifierState | null = null;
    for (let level = 1; level <= levels; level++) {
        const target = Math.floor(getTriangleCount(current) / 2);
        const started = performance.now();
        const result = simplifyToTriangles(current, target, state);
        const elapsed = performance.now() - started;
        const mesh: MeshData = { name: `${name}·LOD${level}`, ...result.output };
        const topology = analyze(mesh);
        const ratio = topology.triangles / getTriangleCount(current);
        console.log(`  LOD${level}: ${topology.triangles} tris (${(ratio * 100).toFixed(0)}% do anterior) em ${elapsed.toFixed(0)} ms · ${topology.components} componentes, ${topology.borderEdges} arestas de borda, erro ${result.error.toExponential(2)}`);
        check(sameTopology(base, topology), `${name} LOD${level} mudou de topologia (furo ou componente perdido): χ = [${topology.euler.slice(0, 6).join(', ')}], ${topology.borderEdges} bordas`);
        check(ratio <= 0.7, `${name} LOD${level} reduziu pouco (${(ratio * 100).toFixed(0)}%)`);
        current = mesh;
        state = result.state;
    }
}
function closeSeams(mesh: MeshData): MeshData {
    const positions = Float32Array.from(mesh.positions, (value) => Math.round(value * 1e6) / 1e6);
    return { ...mesh, positions };
}
runChain('Esfera densa', closeSeams(createDenseSphere(0.5, 180)), 4);
const body = transformMeshData(closeSeams(createDenseSphere(0.3, 120)), mat4.fromTranslationRotationScale(mat4.create(), vec3.create(0, 0.9, 0), vec3.create(), vec3.create(1, 1.5, 1)));
const cards: MeshData[] = [body];
let seed = 7;
const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
};
for (let i = 0; i < 400; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 0.28 + random() * 0.04;
    const strip = createStrip(0.005, 0.25 + random() * 0.15, 24);
    const matrix = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(Math.cos(angle) * radius, 1.3, Math.sin(angle) * radius), vec3.create(Math.PI, angle, 0), vec3.create(1, 1, 1));
    cards.push(transformMeshData(strip, matrix, `card${i}`));
}
runChain('Corpo + cabelo em cartões', mergeMeshData('character', cards), 4);
runChain('Tira isolada', createStrip(0.002, 0.3, 64), 3);
if (failures > 0) {
    console.error(`\n${failures} verificação(ões) falharam.`);
    process.exit(1);
}
console.log('\nTodos os níveis preservaram a topologia: nenhum furo.');
