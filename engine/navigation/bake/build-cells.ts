import { DIRECTION_COUNT, DIRECTION_X, DIRECTION_Z, NavCells, NO_CELL, NULL_AREA } from '../mesh/nav-cells';
import { isInsideGrid, type NavGrid } from '../mesh/nav-grid';
import { NO_SPAN, type SpanField } from './span-field';
export interface CellClearance {
    readonly agentHeight: number;
    readonly climb: number;
}
interface CellOpenings {
    readonly tops: Float32Array;
    readonly ceilings: Float32Array;
}
function ceilingOf(field: SpanField, span: number): number {
    const above = field.next[span];
    return above === NO_SPAN ? Infinity : field.mins[above];
}
function isOpenSpan(field: SpanField, span: number, agentHeight: number): boolean {
    return field.areas[span] !== NULL_AREA && ceilingOf(field, span) - field.maxs[span] >= agentHeight;
}
function countOpenSpans(field: SpanField, columnCount: number, agentHeight: number): Uint32Array {
    const columnStart = new Uint32Array(columnCount + 1);
    let total = 0;
    for (let column = 0; column < columnCount; column++) {
        columnStart[column] = total;
        for (let span = field.first[column]; span !== NO_SPAN; span = field.next[span]) {
            if (isOpenSpan(field, span, agentHeight))
                total++;
        }
    }
    columnStart[columnCount] = total;
    return columnStart;
}
function findLinkedCell(cells: NavCells, openings: CellOpenings, clearance: CellClearance, cell: number, column: number): number {
    const { columnStart, heights } = cells;
    const { tops, ceilings } = openings;
    for (let candidate = columnStart[column]; candidate < columnStart[column + 1]; candidate++) {
        const opening = Math.min(ceilings[cell], ceilings[candidate]) - Math.max(tops[cell], tops[candidate]);
        if (opening >= clearance.agentHeight && Math.abs(heights[candidate] - heights[cell]) <= clearance.climb)
            return candidate;
    }
    return NO_CELL;
}
function linkCells(cells: NavCells, openings: CellOpenings, clearance: CellClearance): void {
    const { grid, links } = cells;
    for (let cell = 0; cell < cells.count; cell++) {
        const x = cells.columnX(cell);
        const z = cells.columnZ(cell);
        for (let direction = 0; direction < DIRECTION_COUNT; direction++) {
            const neighborX = x + DIRECTION_X[direction];
            const neighborZ = z + DIRECTION_Z[direction];
            if (isInsideGrid(grid, neighborX, neighborZ))
                links[cell * DIRECTION_COUNT + direction] = findLinkedCell(cells, openings, clearance, cell, neighborX + neighborZ * grid.width);
        }
    }
}
export function buildCells(field: SpanField, grid: NavGrid, clearance: CellClearance): NavCells {
    const columnCount = grid.width * grid.depth;
    const columnStart = countOpenSpans(field, columnCount, clearance.agentHeight);
    const total = columnStart[columnCount];
    const heights = new Float32Array(total);
    const areas = new Uint8Array(total);
    const cellColumn = new Uint32Array(total);
    const openings: CellOpenings = { tops: new Float32Array(total), ceilings: new Float32Array(total) };
    let cell = 0;
    for (let column = 0; column < columnCount; column++) {
        for (let span = field.first[column]; span !== NO_SPAN; span = field.next[span]) {
            if (!isOpenSpan(field, span, clearance.agentHeight))
                continue;
            heights[cell] = field.surfaces[span];
            areas[cell] = field.areas[span];
            cellColumn[cell] = column;
            openings.tops[cell] = field.maxs[span];
            openings.ceilings[cell] = ceilingOf(field, span);
            cell++;
        }
    }
    const cells = new NavCells(grid, columnStart, cellColumn, heights, areas);
    linkCells(cells, openings, clearance);
    return cells;
}
