import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import { createMaterial } from '@/engine/core/scene/material';
import type { Entity } from '@/engine/core/scene/entity';
import { getTriangleCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createBox, createCapsule, createCone, createCylinder, createSphere, createTorus } from '@/engine/renderer/geometry/primitives';
import { createDenseSphere, createEngravedTorus, createFlutedColumn, createRock, createTorusKnot } from '@/engine/renderer/geometry/dense-primitives';
import type { EditorSession } from '@/engine/editor/session/editor-session';
export const STRESS_GROUP_NAME = 'Estresse';
const LOG_SOURCE = 'Estresse';
export type StressDetail = 'classic' | 'dense';
const FALLBACK_HALF_SIZE = 60;
const EDGE_MARGIN = 4;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SEED = 2024;
function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
function createSharedMeshes(detail: StressDetail): MeshData[] {
    if (detail === 'dense') {
        return [createRock(0.5, 360, 1), createRock(0.5, 360, 2), createDenseSphere(), createEngravedTorus(), createTorusKnot(), createFlutedColumn()];
    }
    return [createBox(), createSphere(0.5, 24, 12), createCylinder(), createCone(), createTorus(), createCapsule()];
}
const PALETTE: readonly [
    number,
    number,
    number
][] = [
    [0.78, 0.33, 0.24],
    [0.26, 0.52, 0.76],
    [0.46, 0.62, 0.34],
    [0.85, 0.72, 0.3],
    [0.56, 0.44, 0.68],
    [0.72, 0.72, 0.7],
];
export function findStressGroup(session: EditorSession): Entity | null {
    return session.scene.root.children.find((child) => child.name === STRESS_GROUP_NAME && child.kind === 'group') ?? null;
}
export function countStressActors(session: EditorSession): number {
    return findStressGroup(session)?.children.length ?? 0;
}
export function generateStressTest(session: EditorSession, count: number, detail: StressDetail = 'classic'): void {
    const { scene } = session;
    clearStressTest(session, false);
    const started = performance.now();
    const terrainEntity = findTerrain(session);
    const terrain = terrainEntity?.terrain ?? null;
    const halfSize = terrain ? Math.max(terrain.halfSize - EDGE_MARGIN, 1) : FALLBACK_HALF_SIZE;
    const random = createRandom(SEED);
    const meshes = createSharedMeshes(detail);
    const meshesBuilt = performance.now();
    const materials = PALETTE.map(([r, g, b]) => createMaterial({ baseColor: vec3.create(r, g, b), roughness: 0.55 }));
    const group = scene.createEntity({ name: STRESS_GROUP_NAME, kind: 'group' });
    const local = vec3.create();
    const world = vec3.create();
    let triangles = 0;
    for (let i = 0; i < count; i++) {
        const mesh = meshes[i % meshes.length];
        const material = materials[Math.floor(random() * materials.length)];
        const entity = scene.createEntity({ name: `${mesh.name}_${i + 1}`, kind: 'mesh', mesh, material }, group);
        const scale = MIN_SCALE + random() * (MAX_SCALE - MIN_SCALE);
        const x = (random() * 2 - 1) * halfSize;
        const z = (random() * 2 - 1) * halfSize;
        let height = 0;
        if (terrainEntity && terrain) {
            vec3.set(local, x, terrain.heightAtLocal(x, z), z);
            mat4.transformPoint(world, terrainEntity.worldMatrix, local);
            height = world[1];
        }
        vec3.set(entity.transform.position, x, height + scale * 0.5, z);
        entity.transform.rotation[1] = random() * 360;
        vec3.set(entity.transform.scale, scale, scale, scale);
        triangles += getTriangleCount(mesh);
    }
    session.notify();
    const sourceTriangles = meshes.reduce((sum, mesh) => sum + getTriangleCount(mesh), 0);
    const meshTime = Math.round(meshesBuilt - started);
    session.log.info(LOG_SOURCE, `${count.toLocaleString('pt-BR')} atores gerados: ${formatTriangles(triangles)} triângulos na cena a partir de ${meshes.length} malhas (${formatTriangles(sourceTriangles)} únicos, geradas em ${meshTime} ms) em ${Math.round(performance.now() - started)} ms.`);
}
function formatTriangles(count: number): string {
    if (count >= 1000000)
        return `${(count / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} M`;
    return Math.round(count).toLocaleString('pt-BR');
}
export function clearStressTest(session: EditorSession, notify = true): void {
    const group = findStressGroup(session);
    if (!group)
        return;
    const removed = group.children.length;
    if (session.selectedEntity && group.contains(session.selectedEntity))
        session.select(null);
    session.scene.root.remove(group);
    if (notify) {
        session.notify();
        session.log.info(LOG_SOURCE, `${removed.toLocaleString('pt-BR')} atores de estresse removidos.`);
    }
}
function findTerrain(session: EditorSession): Entity | null {
    let found: Entity | null = null;
    session.scene.traverseVisible((entity) => {
        if (!found && entity.terrain)
            found = entity;
    });
    return found;
}
