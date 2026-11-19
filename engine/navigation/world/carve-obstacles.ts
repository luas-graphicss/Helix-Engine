import { gridColumn, gridRow } from '../mesh/nav-grid';
import type { NavMesh } from '../mesh/nav-mesh';
import type { NavObstacle } from './nav-obstacle';
function coversPoint(obstacle: NavObstacle, margin: number, offsetX: number, offsetZ: number): boolean {
    if (obstacle.shape === 'capsule')
        return Math.hypot(offsetX, offsetZ) <= obstacle.halfWidth + margin;
    const cos = Math.cos(obstacle.carvedHeading);
    const sin = Math.sin(obstacle.carvedHeading);
    const localX = offsetX * cos - offsetZ * sin;
    const localZ = offsetX * sin + offsetZ * cos;
    return Math.abs(localX) <= obstacle.halfWidth + margin && Math.abs(localZ) <= obstacle.halfDepth + margin;
}
function blockColumn(mesh: NavMesh, column: number, lowest: number, highest: number): void {
    const { columnStart, heights } = mesh.cells;
    for (let cell = columnStart[column]; cell < columnStart[column + 1]; cell++) {
        if (heights[cell] > lowest && heights[cell] < highest)
            mesh.blocked[cell] = 1;
    }
}
function stampObstacle(mesh: NavMesh, obstacle: NavObstacle): void {
    const { grid } = mesh.cells;
    const { agentRadius, agentHeight } = mesh.shape;
    const center = obstacle.carvedPosition;
    const reach = obstacle.boundingRadius + agentRadius;
    const firstColumn = Math.max(0, gridColumn(grid, center[0] - reach));
    const lastColumn = Math.min(grid.width - 1, gridColumn(grid, center[0] + reach));
    const firstRow = Math.max(0, gridRow(grid, center[2] - reach));
    const lastRow = Math.min(grid.depth - 1, gridRow(grid, center[2] + reach));
    const lowest = center[1] - obstacle.halfHeight - agentHeight;
    const highest = center[1] + obstacle.halfHeight;
    for (let row = firstRow; row <= lastRow; row++) {
        const offsetZ = grid.originZ + (row + 0.5) * grid.cellSize - center[2];
        for (let column = firstColumn; column <= lastColumn; column++) {
            const offsetX = grid.originX + (column + 0.5) * grid.cellSize - center[0];
            if (coversPoint(obstacle, agentRadius, offsetX, offsetZ))
                blockColumn(mesh, column + row * grid.width, lowest, highest);
        }
    }
}
export function stampObstacles(mesh: NavMesh, obstacles: readonly NavObstacle[]): void {
    mesh.blocked.fill(0);
    for (const obstacle of obstacles) {
        if (obstacle.isCarving)
            stampObstacle(mesh, obstacle);
    }
    mesh.rebuildPolygons();
}
