import * as vec3 from '@/engine/core/math/vec3';
import { NO_CELL } from './nav-cells';
import type { NavLinkEdge, NavLinkSource } from './nav-link';
import type { NavMesh } from './nav-mesh';
import { clampToCell, findNearestCell } from './nav-mesh-queries';
export function attachLinks(mesh: NavMesh, sources: readonly NavLinkSource[], snapDistance: number): void {
    const edges: NavLinkEdge[] = [];
    for (const source of sources) {
        const startCell = findNearestCell(mesh, source.start[0], source.start[1], source.start[2], snapDistance);
        const endCell = findNearestCell(mesh, source.end[0], source.end[1], source.end[2], snapDistance);
        if (startCell === NO_CELL || endCell === NO_CELL)
            continue;
        const startPolygon = mesh.polygonOf(startCell);
        const endPolygon = mesh.polygonOf(endCell);
        if (startPolygon === endPolygon)
            continue;
        const start = clampToCell(vec3.create(), mesh, startCell, source.start);
        const end = clampToCell(vec3.create(), mesh, endCell, source.end);
        edges.push({ source, fromPolygon: startPolygon, toPolygon: endPolygon, from: start, to: end });
        if (source.bidirectional)
            edges.push({ source, fromPolygon: endPolygon, toPolygon: startPolygon, from: end, to: start });
    }
    mesh.setLinkEdges(edges);
}
