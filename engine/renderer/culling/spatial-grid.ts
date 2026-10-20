import * as aabb from '@/engine/core/math/aabb';
import type { Entity } from '@/engine/core/scene/entity';
import { CULL_INSIDE, CULL_OUTSIDE, type Frustum } from './frustum';
import type { RenderableBounds } from './renderable-bounds';
export const DEFAULT_CHUNK_SIZE = 24;
const KEY_OFFSET = 1 << 15;
const KEY_SPAN = 1 << 16;
interface GridEntry {
    readonly entity: Entity;
    readonly bounds: RenderableBounds;
    cell: GridCell | null;
    boundsVersion: number;
    seenFrame: number;
}
class GridCell {
    readonly members: GridEntry[] = [];
    readonly bounds = aabb.create();
    dirty = true;
}
export interface GridVisitor {
    (entity: Entity, bounds: RenderableBounds, testIndividually: boolean): void;
}
export interface SpatialGridStats {
    cells: number;
    cellsCulled: number;
    culledByCell: number;
}
export class SpatialGrid {
    private readonly cells = new Map<number, GridCell>();
    private readonly entries = new Map<Entity, GridEntry>();
    private frame = 0;
    constructor(readonly chunkSize: number = DEFAULT_CHUNK_SIZE) { }
    beginFrame(): void {
        this.frame++;
    }
    update(entity: Entity, bounds: RenderableBounds): void {
        let entry = this.entries.get(entity);
        if (!entry) {
            entry = { entity, bounds, cell: null, boundsVersion: -1, seenFrame: 0 };
            this.entries.set(entity, entry);
        }
        entry.seenFrame = this.frame;
        if (entry.boundsVersion === bounds.version)
            return;
        entry.boundsVersion = bounds.version;
        const key = this.keyFor(bounds.center[0], bounds.center[2]);
        let cell = this.cells.get(key);
        if (!cell) {
            cell = new GridCell();
            this.cells.set(key, cell);
        }
        if (entry.cell !== cell) {
            if (entry.cell)
                this.detach(entry.cell, entry);
            cell.members.push(entry);
            entry.cell = cell;
        }
        cell.dirty = true;
    }
    forEachCandidate(frustum: Frustum | null, stats: SpatialGridStats, visit: GridVisitor): void {
        stats.cells = 0;
        stats.cellsCulled = 0;
        stats.culledByCell = 0;
        for (const [key, cell] of this.cells) {
            this.pruneStale(cell);
            if (cell.members.length === 0) {
                this.cells.delete(key);
                continue;
            }
            if (cell.dirty)
                this.refit(cell);
            stats.cells++;
            const result = frustum ? frustum.classifyAabb(cell.bounds) : CULL_INSIDE;
            if (result === CULL_OUTSIDE) {
                stats.cellsCulled++;
                stats.culledByCell += cell.members.length;
                continue;
            }
            const testIndividually = result !== CULL_INSIDE;
            const { members } = cell;
            for (let i = 0; i < members.length; i++) {
                visit(members[i].entity, members[i].bounds, testIndividually);
            }
        }
    }
    private keyFor(x: number, z: number): number {
        const cx = Math.floor(x / this.chunkSize) + KEY_OFFSET;
        const cz = Math.floor(z / this.chunkSize) + KEY_OFFSET;
        return cx * KEY_SPAN + cz;
    }
    private pruneStale(cell: GridCell): void {
        const { members } = cell;
        for (let i = members.length - 1; i >= 0; i--) {
            const entry = members[i];
            if (entry.seenFrame === this.frame)
                continue;
            members[i] = members[members.length - 1];
            members.pop();
            this.entries.delete(entry.entity);
            cell.dirty = true;
        }
    }
    private detach(cell: GridCell, entry: GridEntry): void {
        const index = cell.members.indexOf(entry);
        if (index === -1)
            return;
        cell.members[index] = cell.members[cell.members.length - 1];
        cell.members.pop();
        cell.dirty = true;
    }
    private refit(cell: GridCell): void {
        aabb.reset(cell.bounds);
        for (const member of cell.members)
            aabb.union(cell.bounds, cell.bounds, member.bounds.aabb);
        cell.dirty = false;
    }
}
