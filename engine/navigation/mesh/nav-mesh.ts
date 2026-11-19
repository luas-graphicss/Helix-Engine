import { BOUNDS_FLOATS, buildPolygons, NO_POLYGON, type NavPolygons } from './build-polygons';
import { DIRECTION_COUNT, type NavCells, NO_CELL } from './nav-cells';
import type { NavLinkEdge } from './nav-link';
export interface NavMeshShape {
    readonly agentRadius: number;
    readonly agentHeight: number;
    readonly climb: number;
    readonly planarTolerance: number;
}
const NO_LINKS: readonly NavLinkEdge[] = [];
export class NavMesh {
    readonly blocked: Uint8Array;
    polygons: NavPolygons;
    version = 0;
    private linksByPolygon = new Map<number, NavLinkEdge[]>();
    constructor(readonly cells: NavCells, readonly shape: NavMeshShape) {
        this.blocked = new Uint8Array(cells.count);
        this.polygons = buildPolygons(cells, this.blocked, shape.planarTolerance);
    }
    rebuildPolygons(): void {
        this.polygons = buildPolygons(this.cells, this.blocked, this.shape.planarTolerance);
        this.linksByPolygon = new Map();
        this.version++;
    }
    polygonOf(cell: number): number {
        return this.polygons.cellPolygon[cell];
    }
    isWalkable(cell: number): boolean {
        return cell !== NO_CELL && this.polygons.cellPolygon[cell] !== NO_POLYGON;
    }
    walkableLink(cell: number, direction: number): number {
        const neighbor = this.cells.links[cell * DIRECTION_COUNT + direction];
        return this.isWalkable(neighbor) ? neighbor : NO_CELL;
    }
    setLinkEdges(edges: readonly NavLinkEdge[]): void {
        this.linksByPolygon = new Map();
        for (const edge of edges) {
            const outgoing = this.linksByPolygon.get(edge.fromPolygon);
            if (outgoing)
                outgoing.push(edge);
            else
                this.linksByPolygon.set(edge.fromPolygon, [edge]);
        }
    }
    linksFrom(polygon: number): readonly NavLinkEdge[] {
        return this.linksByPolygon.get(polygon) ?? NO_LINKS;
    }
    get walkableArea(): number {
        const { bounds, count } = this.polygons;
        let area = 0;
        for (let polygon = 0; polygon < count; polygon++) {
            const bound = polygon * BOUNDS_FLOATS;
            area += (bounds[bound + 2] - bounds[bound]) * (bounds[bound + 3] - bounds[bound + 1]);
        }
        return area;
    }
}
