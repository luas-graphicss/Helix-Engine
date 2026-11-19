import { clamp } from '@/engine/core/math/scalar';
import { NULL_AREA } from '../mesh/nav-cells';
import type { NavGrid } from '../mesh/nav-grid';
import type { SpanField } from './span-field';
import type { TriangleSoup } from './triangle-soup';
const COMPONENTS = 3;
const TRIANGLE_FLOATS = 9;
const MAX_CLIPPED_VERTICES = 12;
const AXIS_X = 0;
const AXIS_Y = 1;
const AXIS_Z = 2;
const KEEP_ABOVE = 1;
const KEEP_BELOW = -1;
const DEGENERATE_AREA = 1e-12;
const VERTICAL_NORMAL = 1e-6;
const triangle = new Float32Array(TRIANGLE_FLOATS);
const scratch = new Float32Array(MAX_CLIPPED_VERTICES * COMPONENTS);
const rowPolygon = new Float32Array(MAX_CLIPPED_VERTICES * COMPONENTS);
const cellPolygon = new Float32Array(MAX_CLIPPED_VERTICES * COMPONENTS);
const plane = { normalX: 0, normalY: 1, normalZ: 0, area: NULL_AREA };
function clipPolygon(input: Float32Array, count: number, output: Float32Array, axis: number, bound: number, side: number): number {
    let clipped = 0;
    for (let index = 0, previous = count - 1; index < count; previous = index++) {
        const currentOffset = index * COMPONENTS;
        const previousOffset = previous * COMPONENTS;
        const currentDistance = (input[currentOffset + axis] - bound) * side;
        const previousDistance = (input[previousOffset + axis] - bound) * side;
        if ((previousDistance >= 0) !== (currentDistance >= 0)) {
            const blend = previousDistance / (previousDistance - currentDistance);
            for (let component = 0; component < COMPONENTS; component++)
                output[clipped * COMPONENTS + component] = input[previousOffset + component] + (input[currentOffset + component] - input[previousOffset + component]) * blend;
            clipped++;
        }
        if (currentDistance >= 0) {
            for (let component = 0; component < COMPONENTS; component++)
                output[clipped * COMPONENTS + component] = input[currentOffset + component];
            clipped++;
        }
    }
    return clipped;
}
function clipToSlab(input: Float32Array, count: number, output: Float32Array, axis: number, min: number, max: number): number {
    const aboveMin = clipPolygon(input, count, scratch, axis, min, KEEP_ABOVE);
    return clipPolygon(scratch, aboveMin, output, axis, max, KEEP_BELOW);
}
function lowest(polygon: Float32Array, count: number, axis: number): number {
    let bound = Infinity;
    for (let index = 0; index < count; index++)
        bound = Math.min(bound, polygon[index * COMPONENTS + axis]);
    return bound;
}
function highest(polygon: Float32Array, count: number, axis: number): number {
    let bound = -Infinity;
    for (let index = 0; index < count; index++)
        bound = Math.max(bound, polygon[index * COMPONENTS + axis]);
    return bound;
}
function measurePlane(walkableArea: number, minWalkableNormalY: number): boolean {
    const edgeX = triangle[3] - triangle[0];
    const edgeY = triangle[4] - triangle[1];
    const edgeZ = triangle[5] - triangle[2];
    const sideX = triangle[6] - triangle[0];
    const sideY = triangle[7] - triangle[1];
    const sideZ = triangle[8] - triangle[2];
    const normalX = edgeY * sideZ - edgeZ * sideY;
    const normalY = edgeZ * sideX - edgeX * sideZ;
    const normalZ = edgeX * sideY - edgeY * sideX;
    const lengthSquared = normalX * normalX + normalY * normalY + normalZ * normalZ;
    if (lengthSquared < DEGENERATE_AREA)
        return false;
    const length = Math.sqrt(lengthSquared);
    plane.normalX = normalX / length;
    plane.normalY = normalY / length;
    plane.normalZ = normalZ / length;
    plane.area = plane.normalY >= minWalkableNormalY ? walkableArea : NULL_AREA;
    return true;
}
function surfaceHeight(x: number, z: number, low: number, high: number): number {
    if (Math.abs(plane.normalY) < VERTICAL_NORMAL)
        return high;
    const height = triangle[1] - (plane.normalX * (x - triangle[0]) + plane.normalZ * (z - triangle[2])) / plane.normalY;
    return clamp(height, low, high);
}
function rasterizeRow(field: SpanField, grid: NavGrid, row: number, count: number): void {
    const { originX, originZ, cellSize, width } = grid;
    const firstColumn = Math.max(0, Math.floor((lowest(rowPolygon, count, AXIS_X) - originX) / cellSize));
    const lastColumn = Math.min(width - 1, Math.floor((highest(rowPolygon, count, AXIS_X) - originX) / cellSize));
    const centerZ = originZ + (row + 0.5) * cellSize;
    for (let column = firstColumn; column <= lastColumn; column++) {
        const cellMin = originX + column * cellSize;
        const clipped = clipToSlab(rowPolygon, count, cellPolygon, AXIS_X, cellMin, cellMin + cellSize);
        if (clipped < 3)
            continue;
        const low = lowest(cellPolygon, clipped, AXIS_Y);
        const high = highest(cellPolygon, clipped, AXIS_Y);
        field.add(column + row * width, low, high, surfaceHeight(cellMin + cellSize / 2, centerZ, low, high), plane.area);
    }
}
function rasterizeTriangle(field: SpanField, grid: NavGrid): void {
    const { originZ, cellSize, depth } = grid;
    const firstRow = Math.max(0, Math.floor((lowest(triangle, 3, AXIS_Z) - originZ) / cellSize));
    const lastRow = Math.min(depth - 1, Math.floor((highest(triangle, 3, AXIS_Z) - originZ) / cellSize));
    for (let row = firstRow; row <= lastRow; row++) {
        const rowMin = originZ + row * cellSize;
        const count = clipToSlab(triangle, 3, rowPolygon, AXIS_Z, rowMin, rowMin + cellSize);
        if (count >= 3)
            rasterizeRow(field, grid, row, count);
    }
}
export function rasterizeTriangles(field: SpanField, grid: NavGrid, soup: TriangleSoup, minWalkableNormalY: number): void {
    for (let index = 0; index < soup.count; index++) {
        const offset = index * TRIANGLE_FLOATS;
        for (let component = 0; component < TRIANGLE_FLOATS; component++)
            triangle[component] = soup.positions[offset + component];
        if (measurePlane(soup.areas[index], minWalkableNormalY))
            rasterizeTriangle(field, grid);
    }
}
