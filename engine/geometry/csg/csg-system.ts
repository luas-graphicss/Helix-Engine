import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { getMeshVersion, markMeshDirty, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { copyMeshData, csgOperate, type CsgOperation, type CsgOperationStats } from './csg-boolean';
import type { CsgPrecision } from './csg-settings';
export interface CsgTargetStats {
    brushes: number;
    activeBrushes: number;
    sourceTriangles: number;
    resultTriangles: number;
    clippedTriangles: number;
    lastBuildMs: number;
    builds: number;
    deferred: boolean;
}
export interface CsgUpdateOptions {
    deferHeavy?: boolean;
}
type MutableMesh = {
    -readonly [K in keyof MeshData]: MeshData[K];
};
interface StageKey {
    brush: Entity;
    mesh: MeshData;
    meshVersion: number;
    operation: CsgOperation;
    matrix: Float32Array;
}
interface Stage {
    key: StageKey;
    output: MeshData;
}
interface TargetState {
    result: MutableMesh;
    source: MeshData;
    sourceVersion: number;
    precision: CsgPrecision;
    stages: Stage[];
    stats: CsgTargetStats;
}
export type CsgRebuildListener = (entity: Entity, stats: CsgTargetStats) => void;
export const CSG_HEAVY_BUILD_MS = 50;
export function collectBrushes(target: Entity): Entity[] {
    const brushes: Entity[] = [];
    for (const child of target.children) {
        if (child.csgBrush && child.csgBrush.enabled && child.visible && child.mesh)
            brushes.push(child);
    }
    return brushes;
}
export function brushTarget(brush: Entity): Entity | null {
    const parent = brush.parent;
    return parent && parent.csg ? parent : null;
}
function createStats(): CsgTargetStats {
    return { brushes: 0, activeBrushes: 0, sourceTriangles: 0, resultTriangles: 0, clippedTriangles: 0, lastBuildMs: 0, builds: 0, deferred: false };
}
function sameMatrix(a: Float32Array, b: Mat4): boolean {
    for (let i = 0; i < 16; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
export class CsgSystem {
    private readonly states = new WeakMap<Entity, TargetState>();
    private readonly listeners = new Set<CsgRebuildListener>();
    private readonly inverseTarget = mat4.create();
    private readonly relative = mat4.create();
    private readonly operationStats: CsgOperationStats = { clippedTriangles: 0, brushTriangles: 0, resultTriangles: 0 };
    private deferHeavy = false;
    onRebuilt(listener: CsgRebuildListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    statsOf(entity: Entity): CsgTargetStats | null {
        return this.states.get(entity)?.stats ?? null;
    }
    invalidate(entity: Entity): void {
        this.states.delete(entity);
    }
    update(scene: Scene, options: CsgUpdateOptions = {}): void {
        this.deferHeavy = options.deferHeavy === true;
        scene.updateWorldMatrices();
        this.visit(scene.root);
    }
    rebuildNow(scene: Scene, entity: Entity): void {
        this.invalidate(entity);
        scene.updateWorldMatrices();
        this.reconcile(entity, true);
    }
    private visit(entity: Entity): void {
        const { children } = entity;
        for (let i = 0; i < children.length; i++)
            this.visit(children[i]);
        if (entity.csg)
            this.reconcile(entity, false);
    }
    private reconcile(entity: Entity, force: boolean): void {
        const settings = entity.csg;
        const mesh = entity.mesh;
        if (!settings || !mesh)
            return;
        let state = this.states.get(entity);
        if (!state || state.result !== mesh) {
            let result: MutableMesh;
            if (mesh === settings.sourceMesh) {
                result = copyMeshData(mesh);
                entity.mesh = result;
            }
            else {
                result = mesh as MutableMesh;
            }
            state = {
                result,
                source: settings.sourceMesh,
                sourceVersion: getMeshVersion(settings.sourceMesh),
                precision: settings.precision,
                stages: [],
                stats: createStats(),
            };
            this.states.set(entity, state);
        }
        if (!force && !settings.live && state.stats.builds > 0)
            return;
        const brushes = collectBrushes(entity);
        if (!mat4.invert(this.inverseTarget, entity.worldMatrix))
            return;
        const sourceVersion = getMeshVersion(settings.sourceMesh);
        const sourceChanged = state.source !== settings.sourceMesh || state.sourceVersion !== sourceVersion || state.precision !== settings.precision;
        let dirtyFrom = sourceChanged ? 0 : Infinity;
        for (let i = 0; i < brushes.length && i < dirtyFrom; i++) {
            const brush = brushes[i];
            const stage = state.stages[i];
            if (!stage) {
                dirtyFrom = i;
                break;
            }
            const brushMesh = brush.mesh as MeshData;
            const brushSettings = brush.csgBrush;
            mat4.multiply(this.relative, this.inverseTarget, brush.worldMatrix);
            if (stage.key.brush !== brush ||
                stage.key.mesh !== brushMesh ||
                stage.key.meshVersion !== getMeshVersion(brushMesh) ||
                stage.key.operation !== brushSettings?.operation ||
                !sameMatrix(stage.key.matrix, this.relative)) {
                dirtyFrom = i;
                break;
            }
        }
        if (state.stages.length > brushes.length)
            dirtyFrom = Math.min(dirtyFrom, brushes.length);
        if (dirtyFrom === Infinity && state.stats.builds > 0)
            return;
        if (!force && this.deferHeavy && state.stats.builds > 0 && state.stats.lastBuildMs > CSG_HEAVY_BUILD_MS) {
            if (!state.stats.deferred) {
                state.stats.deferred = true;
                for (const listener of this.listeners)
                    listener(entity, state.stats);
            }
            return;
        }
        this.rebuild(entity, state, brushes, Math.min(dirtyFrom, brushes.length));
    }
    private rebuild(entity: Entity, state: TargetState, brushes: Entity[], from: number): void {
        const started = performance.now();
        const settings = entity.csg;
        if (!settings)
            return;
        state.source = settings.sourceMesh;
        state.sourceVersion = getMeshVersion(settings.sourceMesh);
        state.precision = settings.precision;
        state.stages.length = Math.min(state.stages.length, from);
        const exact = settings.precision === 'exact';
        let input: MeshData = from === 0 ? settings.sourceMesh : state.stages[from - 1].output;
        let clipped = 0;
        for (let i = from; i < brushes.length; i++) {
            const brush = brushes[i];
            const brushMesh = brush.mesh as MeshData;
            const operation = (brush.csgBrush?.operation ?? 'subtract') as CsgOperation;
            mat4.multiply(this.relative, this.inverseTarget, brush.worldMatrix);
            const output = csgOperate(operation, input, brushMesh, this.relative, this.operationStats, exact);
            clipped += this.operationStats.clippedTriangles;
            state.stages.push({
                key: { brush, mesh: brushMesh, meshVersion: getMeshVersion(brushMesh), operation, matrix: new Float32Array(this.relative) },
                output,
            });
            input = output;
        }
        const { result } = state;
        result.positions = input.positions;
        result.normals = input.normals;
        result.uvs = input.uvs;
        result.indices = input.indices;
        markMeshDirty(result);
        const { stats } = state;
        stats.brushes = entity.children.reduce((count, child) => count + (child.csgBrush ? 1 : 0), 0);
        stats.activeBrushes = brushes.length;
        stats.sourceTriangles = settings.sourceMesh.indices.length / 3;
        stats.resultTriangles = result.indices.length / 3;
        stats.clippedTriangles = clipped;
        stats.lastBuildMs = performance.now() - started;
        stats.builds++;
        stats.deferred = false;
        for (const listener of this.listeners)
            listener(entity, stats);
    }
}
