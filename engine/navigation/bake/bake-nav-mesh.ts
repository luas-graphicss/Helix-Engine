import { DEG_TO_RAD } from '@/engine/core/math/scalar';
import { NavMesh } from '../mesh/nav-mesh';
import type { NavGrid } from '../mesh/nav-grid';
import { buildCells } from './build-cells';
import { erodeCells, paintAreaVolume, removeCellsOutsideHeights, removeSmallRegions, type NavAreaVolume } from './filter-cells';
import { rasterizeHeightSource, type NavHeightSource } from './rasterize-height-source';
import { rasterizeTriangles } from './rasterize-triangles';
import { SpanField } from './span-field';
import type { TriangleSoup } from './triangle-soup';
export interface NavBakeInput {
    readonly triangles: TriangleSoup;
    readonly heightSources: readonly NavHeightSource[];
    readonly areaVolumes: readonly NavAreaVolume[];
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
    readonly minHeight: number;
    readonly maxHeight: number;
}
export interface NavBakeSettings {
    readonly agentRadius: number;
    readonly agentHeight: number;
    readonly maxSlope: number;
    readonly stepHeight: number;
    readonly cellSize: number;
    readonly minRegionArea: number;
}
const MAX_COLUMNS = 1 << 20;
const CLIMB_MARGIN = 1e-3;
const MIN_PLANAR_TOLERANCE = 0.05;
const PLANAR_TOLERANCE_PER_CELL = 0.5;
function createGrid(input: NavBakeInput, requestedCellSize: number): NavGrid | null {
    const spanX = input.maxX - input.minX;
    const spanZ = input.maxZ - input.minZ;
    if (!(spanX > 0 && spanZ > 0) || !Number.isFinite(spanX * spanZ))
        return null;
    const cellSize = Math.max(requestedCellSize, Math.sqrt((spanX * spanZ) / MAX_COLUMNS));
    return { originX: input.minX, originZ: input.minZ, cellSize, width: Math.ceil(spanX / cellSize), depth: Math.ceil(spanZ / cellSize) };
}
export function bakeNavMesh(input: NavBakeInput, settings: NavBakeSettings): NavMesh | null {
    const grid = createGrid(input, settings.cellSize);
    if (!grid)
        return null;
    const slope = settings.maxSlope * DEG_TO_RAD;
    const minWalkableNormalY = Math.cos(slope);
    const climb = Math.max(settings.stepHeight, grid.cellSize * Math.tan(slope)) + CLIMB_MARGIN;
    const field = new SpanField(grid.width * grid.depth, climb);
    rasterizeTriangles(field, grid, input.triangles, minWalkableNormalY);
    for (const source of input.heightSources)
        rasterizeHeightSource(field, grid, source, minWalkableNormalY);
    const cells = buildCells(field, grid, { agentHeight: settings.agentHeight, climb });
    for (const volume of input.areaVolumes)
        paintAreaVolume(cells, volume);
    if (Number.isFinite(input.minHeight) || Number.isFinite(input.maxHeight))
        removeCellsOutsideHeights(cells, input.minHeight, input.maxHeight);
    erodeCells(cells, Math.ceil(settings.agentRadius / grid.cellSize));
    removeSmallRegions(cells, Math.ceil(settings.minRegionArea / (grid.cellSize * grid.cellSize)));
    const mesh = new NavMesh(cells, {
        agentRadius: settings.agentRadius,
        agentHeight: settings.agentHeight,
        climb,
        planarTolerance: Math.max(MIN_PLANAR_TOLERANCE, grid.cellSize * PLANAR_TOLERANCE_PER_CELL),
    });
    return mesh.polygons.count > 0 ? mesh : null;
}
