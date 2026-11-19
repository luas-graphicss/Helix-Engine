import { DIRECTION_COUNT, EAST, type NavCells, NO_CELL, NORTH, NULL_AREA, SOUTH, WEST } from './nav-cells';
export const NO_POLYGON = -1;
export const PORTAL_FLOATS = 6;
export const BOUNDS_FLOATS = 4;
const PLANE_FLOATS = 3;
export interface NavPolygons {
    readonly count: number;
    readonly cellPolygon: Int32Array;
    readonly bounds: Float32Array;
    readonly planes: Float32Array;
    readonly areas: Uint8Array;
    readonly portalStart: Uint32Array;
    readonly portalTarget: Int32Array;
    readonly portalPoints: Float32Array;
}
function planeHeight(planes: ArrayLike<number>, bounds: ArrayLike<number>, polygon: number, x: number, z: number): number {
    const plane = polygon * PLANE_FLOATS;
    const bound = polygon * BOUNDS_FLOATS;
    return planes[plane] + planes[plane + 1] * (x - bounds[bound]) + planes[plane + 2] * (z - bounds[bound + 1]);
}
export function polygonHeight(polygons: NavPolygons, polygon: number, x: number, z: number): number {
    return planeHeight(polygons.planes, polygons.bounds, polygon, x, z);
}
class PolygonBuilder {
    private readonly cellPolygon: Int32Array;
    private readonly members: number[] = [];
    private readonly memberStart: number[] = [0];
    private readonly widths: number[] = [];
    private readonly bounds: number[] = [];
    private readonly planes: number[] = [];
    private readonly areas: number[] = [];
    private readonly portalTargets: number[] = [];
    private readonly portalPoints: number[] = [];
    private anchorHeight = 0;
    private anchorArea = 0;
    private risePerColumn = 0;
    private risePerRow = 0;
    constructor(private readonly cells: NavCells, private readonly blocked: Uint8Array, private readonly tolerance: number) {
        this.cellPolygon = new Int32Array(cells.count).fill(NO_POLYGON);
    }
    build(): NavPolygons {
        for (let cell = 0; cell < this.cells.count; cell++) {
            if (this.isFree(cell))
                this.grow(cell);
        }
        const count = this.widths.length;
        const portalStart = new Uint32Array(count + 1);
        for (let polygon = 0; polygon < count; polygon++) {
            portalStart[polygon] = this.portalTargets.length;
            for (let side = 0; side < DIRECTION_COUNT; side++)
                this.emitSide(polygon, side);
        }
        portalStart[count] = this.portalTargets.length;
        return {
            count,
            cellPolygon: this.cellPolygon,
            bounds: Float32Array.from(this.bounds),
            planes: Float32Array.from(this.planes),
            areas: Uint8Array.from(this.areas),
            portalStart,
            portalTarget: Int32Array.from(this.portalTargets),
            portalPoints: Float32Array.from(this.portalPoints),
        };
    }
    private isUsable(cell: number): boolean {
        return this.cells.areas[cell] !== NULL_AREA && this.blocked[cell] === 0;
    }
    private isFree(cell: number): boolean {
        return this.isUsable(cell) && this.cellPolygon[cell] === NO_POLYGON;
    }
    private neighbor(cell: number, direction: number): number {
        const linked = this.cells.links[cell * DIRECTION_COUNT + direction];
        return linked !== NO_CELL && this.isUsable(linked) ? linked : NO_CELL;
    }
    private fits(cell: number, column: number, row: number): boolean {
        if (cell === NO_CELL || !this.isFree(cell) || this.cells.areas[cell] !== this.anchorArea)
            return false;
        const expected = this.anchorHeight + this.risePerColumn * column + this.risePerRow * row;
        return Math.abs(this.cells.heights[cell] - expected) <= this.tolerance;
    }
    private grow(anchor: number): void {
        const { cells, members } = this;
        const polygon = this.widths.length;
        const start = members.length;
        const east = this.neighbor(anchor, EAST);
        const north = this.neighbor(anchor, NORTH);
        this.anchorHeight = cells.heights[anchor];
        this.anchorArea = cells.areas[anchor];
        this.risePerColumn = east === NO_CELL ? 0 : cells.heights[east] - this.anchorHeight;
        this.risePerRow = north === NO_CELL ? 0 : cells.heights[north] - this.anchorHeight;
        members.push(anchor);
        for (let column = 1;; column++) {
            const candidate = this.neighbor(members[members.length - 1], EAST);
            if (!this.fits(candidate, column, 0))
                break;
            members.push(candidate);
        }
        const width = members.length - start;
        let rows = 1;
        while (this.appendRow(start + (rows - 1) * width, width, rows))
            rows++;
        for (let index = start; index < members.length; index++)
            this.cellPolygon[members[index]] = polygon;
        const { originX, originZ, cellSize } = cells.grid;
        const minX = originX + cells.columnX(anchor) * cellSize;
        const minZ = originZ + cells.columnZ(anchor) * cellSize;
        this.bounds.push(minX, minZ, minX + width * cellSize, minZ + rows * cellSize);
        this.planes.push(this.anchorHeight - (this.risePerColumn + this.risePerRow) / 2, this.risePerColumn / cellSize, this.risePerRow / cellSize);
        this.areas.push(this.anchorArea);
        this.widths.push(width);
        this.memberStart.push(members.length);
    }
    private appendRow(previousRowStart: number, width: number, row: number): boolean {
        const { members } = this;
        const rowStart = members.length;
        for (let column = 0; column < width; column++) {
            const candidate = this.neighbor(members[previousRowStart + column], NORTH);
            const isConnected = column === 0 || this.neighbor(members[rowStart + column - 1], EAST) === candidate;
            if (!isConnected || !this.fits(candidate, column, row)) {
                members.length = rowStart;
                return false;
            }
            members.push(candidate);
        }
        return true;
    }
    private sideLength(polygon: number, side: number): number {
        const width = this.widths[polygon];
        const rows = (this.memberStart[polygon + 1] - this.memberStart[polygon]) / width;
        return side === WEST || side === EAST ? rows : width;
    }
    private memberAt(polygon: number, side: number, step: number): number {
        const start = this.memberStart[polygon];
        const width = this.widths[polygon];
        if (side === WEST)
            return this.members[start + step * width];
        if (side === EAST)
            return this.members[start + step * width + width - 1];
        if (side === SOUTH)
            return this.members[start + step];
        return this.members[this.memberStart[polygon + 1] - width + step];
    }
    private polygonAcross(cell: number, side: number): number {
        const neighbor = this.neighbor(cell, side);
        return neighbor === NO_CELL ? NO_POLYGON : this.cellPolygon[neighbor];
    }
    private emitSide(polygon: number, side: number): void {
        const length = this.sideLength(polygon, side);
        let runTarget = NO_POLYGON;
        let runStart = 0;
        for (let step = 0; step <= length; step++) {
            const target = step < length ? this.polygonAcross(this.memberAt(polygon, side, step), side) : NO_POLYGON;
            if (target === runTarget)
                continue;
            if (runTarget !== NO_POLYGON)
                this.emitPortal(polygon, side, runStart, step, runTarget);
            runTarget = target;
            runStart = step;
        }
    }
    private emitPortal(polygon: number, side: number, from: number, to: number, target: number): void {
        const bound = polygon * BOUNDS_FLOATS;
        const { cellSize } = this.cells.grid;
        const minX = this.bounds[bound];
        const minZ = this.bounds[bound + 1];
        const maxX = this.bounds[bound + 2];
        const maxZ = this.bounds[bound + 3];
        this.portalTargets.push(target);
        if (side === WEST)
            this.pushPortal(polygon, minX, minZ + from * cellSize, minX, minZ + to * cellSize);
        else if (side === EAST)
            this.pushPortal(polygon, maxX, minZ + to * cellSize, maxX, minZ + from * cellSize);
        else if (side === NORTH)
            this.pushPortal(polygon, minX + from * cellSize, maxZ, minX + to * cellSize, maxZ);
        else
            this.pushPortal(polygon, minX + to * cellSize, minZ, minX + from * cellSize, minZ);
    }
    private pushPortal(polygon: number, leftX: number, leftZ: number, rightX: number, rightZ: number): void {
        const leftHeight = planeHeight(this.planes, this.bounds, polygon, leftX, leftZ);
        const rightHeight = planeHeight(this.planes, this.bounds, polygon, rightX, rightZ);
        this.portalPoints.push(leftX, leftHeight, leftZ, rightX, rightHeight, rightZ);
    }
}
export function buildPolygons(cells: NavCells, blocked: Uint8Array, planarTolerance: number): NavPolygons {
    return new PolygonBuilder(cells, blocked, planarTolerance).build();
}
