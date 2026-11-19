import { clamp } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { BOUNDS_FLOATS, polygonHeight, PORTAL_FLOATS } from '../mesh/build-polygons';
import { NO_CELL } from '../mesh/nav-cells';
import type { NavLinkEdge } from '../mesh/nav-link';
import type { NavMesh } from '../mesh/nav-mesh';
import { clampToCell, findNearestCell } from '../mesh/nav-mesh-queries';
import type { CorridorSearch, NavCorridor } from './corridor-search';
import { pullString } from './funnel';
import { INVALID_PATH, type NavPath } from './nav-path';
import type { NavQueryFilter } from './nav-query-filter';
const POINT_FLOATS = 3;
const SAME_CORNER = 1e-4;
class PathAssembler {
    readonly corners: Vec3[] = [];
    readonly links: (NavLinkEdge | null)[] = [];
    private readonly funnel: number[] = [];
    private readonly pulled: number[] = [];
    pushPoint(point: Vec3): void {
        this.funnel.push(point[0], point[1], point[2], point[0], point[1], point[2]);
    }
    pushPortal(points: Float32Array, portal: number): void {
        const offset = portal * PORTAL_FLOATS;
        for (let component = 0; component < PORTAL_FLOATS; component++)
            this.funnel.push(points[offset + component]);
    }
    flush(): void {
        this.pulled.length = 0;
        pullString(this.funnel, this.funnel.length / PORTAL_FLOATS, this.pulled);
        for (let offset = 0; offset < this.pulled.length; offset += POINT_FLOATS)
            this.addCorner(this.pulled[offset], this.pulled[offset + 1], this.pulled[offset + 2]);
        this.funnel.length = 0;
    }
    markLink(edge: NavLinkEdge): void {
        this.links[this.links.length - 1] = edge;
    }
    get length(): number {
        let total = 0;
        for (let index = 1; index < this.corners.length; index++)
            total += vec3.distance(this.corners[index - 1], this.corners[index]);
        return total;
    }
    private addCorner(x: number, y: number, z: number): void {
        const previous = this.corners[this.corners.length - 1];
        const isRepeated = previous !== undefined && this.links[this.links.length - 1] === null
            && Math.abs(previous[0] - x) < SAME_CORNER && Math.abs(previous[2] - z) < SAME_CORNER;
        if (isRepeated)
            return;
        this.corners.push(vec3.create(x, y, z));
        this.links.push(null);
    }
}
function closestPointInPolygon(mesh: NavMesh, polygon: number, point: Vec3): Vec3 {
    const { bounds } = mesh.polygons;
    const bound = polygon * BOUNDS_FLOATS;
    const x = clamp(point[0], bounds[bound], bounds[bound + 2]);
    const z = clamp(point[2], bounds[bound + 1], bounds[bound + 3]);
    return vec3.create(x, polygonHeight(mesh.polygons, polygon, x, z), z);
}
function assemblePath(mesh: NavMesh, corridor: NavCorridor, start: Vec3, end: Vec3): NavPath {
    const assembler = new PathAssembler();
    const lastPolygon = corridor.polygons[corridor.polygons.length - 1];
    assembler.pushPoint(start);
    for (let step = 1; step < corridor.polygons.length; step++) {
        const link = corridor.links[step];
        if (!link) {
            assembler.pushPortal(mesh.polygons.portalPoints, corridor.portals[step]);
            continue;
        }
        assembler.pushPoint(link.from);
        assembler.flush();
        assembler.markLink(link);
        assembler.pushPoint(link.to);
    }
    assembler.pushPoint(corridor.isComplete ? end : closestPointInPolygon(mesh, lastPolygon, end));
    assembler.flush();
    return { status: corridor.isComplete ? 'complete' : 'partial', corners: assembler.corners, links: assembler.links, length: assembler.length };
}
export function findPath(mesh: NavMesh, search: CorridorSearch, start: Vec3, end: Vec3, filter: NavQueryFilter, snapDistance: number): NavPath {
    const startCell = findNearestCell(mesh, start[0], start[1], start[2], snapDistance);
    const endCell = findNearestCell(mesh, end[0], end[1], end[2], snapDistance);
    if (startCell === NO_CELL || endCell === NO_CELL)
        return INVALID_PATH;
    const from = clampToCell(vec3.create(), mesh, startCell, start);
    const to = clampToCell(vec3.create(), mesh, endCell, end);
    const corridor = search.find(mesh, mesh.polygonOf(startCell), from, mesh.polygonOf(endCell), to, filter);
    return assemblePath(mesh, corridor, from, to);
}
