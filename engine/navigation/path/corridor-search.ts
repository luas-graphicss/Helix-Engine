import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import { NO_POLYGON, PORTAL_FLOATS } from '../mesh/build-polygons';
import type { NavLinkEdge } from '../mesh/nav-link';
import type { NavMesh } from '../mesh/nav-mesh';
import { MinHeap } from './min-heap';
import { allowsArea, type NavQueryFilter } from './nav-query-filter';
export const NO_PORTAL = -1;
export interface NavCorridor {
    readonly polygons: number[];
    readonly portals: number[];
    readonly links: (NavLinkEdge | null)[];
    readonly isComplete: boolean;
}
const POINT_FLOATS = 3;
const PORTAL_INSET = 0.02;
const PARALLEL = 1e-9;
const crossing = new Float32Array(POINT_FLOATS);
function crossPortal(points: Float32Array, portal: number, fromX: number, fromZ: number, toX: number, toZ: number): void {
    const offset = portal * PORTAL_FLOATS;
    const leftX = points[offset];
    const leftZ = points[offset + 2];
    const spanX = points[offset + 3] - leftX;
    const spanZ = points[offset + 5] - leftZ;
    const headingX = toX - fromX;
    const headingZ = toZ - fromZ;
    const denominator = spanX * headingZ - spanZ * headingX;
    const along = Math.abs(denominator) < PARALLEL
        ? ((fromX - leftX) * spanX + (fromZ - leftZ) * spanZ) / (spanX * spanX + spanZ * spanZ)
        : ((fromX - leftX) * headingZ - (fromZ - leftZ) * headingX) / denominator;
    const blend = clamp(along, PORTAL_INSET, 1 - PORTAL_INSET);
    crossing[0] = leftX + spanX * blend;
    crossing[1] = points[offset + 1] + (points[offset + 4] - points[offset + 1]) * blend;
    crossing[2] = leftZ + spanZ * blend;
}
export class CorridorSearch {
    private readonly heap = new MinHeap();
    private costs = new Float32Array(0);
    private entries = new Float32Array(0);
    private parents = new Int32Array(0);
    private portals = new Int32Array(0);
    private seen = new Uint32Array(0);
    private closed = new Uint32Array(0);
    private links: (NavLinkEdge | null)[] = [];
    private query = 0;
    find(mesh: NavMesh, startPolygon: number, start: Vec3, endPolygon: number, end: Vec3, filter: NavQueryFilter): NavCorridor {
        this.reserve(mesh.polygons.count);
        this.query++;
        this.heap.clear();
        this.relax(startPolygon, NO_POLYGON, NO_PORTAL, null, 0, start[0], start[1], start[2], end);
        let closest = startPolygon;
        let closestDistance = Infinity;
        while (!this.heap.isEmpty) {
            const polygon = this.heap.pop();
            if (this.closed[polygon] === this.query)
                continue;
            this.closed[polygon] = this.query;
            if (polygon === endPolygon) {
                closest = polygon;
                break;
            }
            const remaining = this.distanceToEnd(polygon, end);
            if (remaining < closestDistance) {
                closest = polygon;
                closestDistance = remaining;
            }
            this.expandPortals(mesh, polygon, end, filter);
            this.expandLinks(mesh, polygon, end, filter);
        }
        return this.trace(closest, closest === endPolygon);
    }
    private reserve(polygonCount: number): void {
        if (this.costs.length >= polygonCount)
            return;
        this.costs = new Float32Array(polygonCount);
        this.entries = new Float32Array(polygonCount * POINT_FLOATS);
        this.parents = new Int32Array(polygonCount);
        this.portals = new Int32Array(polygonCount);
        this.seen = new Uint32Array(polygonCount);
        this.closed = new Uint32Array(polygonCount);
        this.links = new Array<NavLinkEdge | null>(polygonCount).fill(null);
        this.query = 0;
    }
    private distanceToEnd(polygon: number, end: Vec3): number {
        const entry = polygon * POINT_FLOATS;
        return Math.hypot(this.entries[entry] - end[0], this.entries[entry + 1] - end[1], this.entries[entry + 2] - end[2]);
    }
    private relax(polygon: number, parent: number, portal: number, link: NavLinkEdge | null, cost: number, x: number, y: number, z: number, end: Vec3): void {
        if (this.closed[polygon] === this.query)
            return;
        if (this.seen[polygon] === this.query && cost >= this.costs[polygon])
            return;
        const entry = polygon * POINT_FLOATS;
        this.seen[polygon] = this.query;
        this.costs[polygon] = cost;
        this.parents[polygon] = parent;
        this.portals[polygon] = portal;
        this.links[polygon] = link;
        this.entries[entry] = x;
        this.entries[entry + 1] = y;
        this.entries[entry + 2] = z;
        this.heap.push(polygon, cost + Math.hypot(x - end[0], y - end[1], z - end[2]));
    }
    private expandPortals(mesh: NavMesh, polygon: number, end: Vec3, filter: NavQueryFilter): void {
        const { areas, portalStart, portalTarget, portalPoints } = mesh.polygons;
        const entry = polygon * POINT_FLOATS;
        const x = this.entries[entry];
        const y = this.entries[entry + 1];
        const z = this.entries[entry + 2];
        const areaCost = filter.areaCosts[areas[polygon]];
        for (let portal = portalStart[polygon]; portal < portalStart[polygon + 1]; portal++) {
            const target = portalTarget[portal];
            if (!allowsArea(filter, areas[target]))
                continue;
            crossPortal(portalPoints, portal, x, z, end[0], end[2]);
            const stride = Math.hypot(crossing[0] - x, crossing[1] - y, crossing[2] - z);
            this.relax(target, polygon, portal, null, this.costs[polygon] + stride * areaCost, crossing[0], crossing[1], crossing[2], end);
        }
    }
    private expandLinks(mesh: NavMesh, polygon: number, end: Vec3, filter: NavQueryFilter): void {
        const { areas } = mesh.polygons;
        const entry = polygon * POINT_FLOATS;
        for (const edge of mesh.linksFrom(polygon)) {
            const { source, from, to } = edge;
            if (!allowsArea(filter, source.area) || !allowsArea(filter, areas[edge.toPolygon]))
                continue;
            const approach = Math.hypot(from[0] - this.entries[entry], from[1] - this.entries[entry + 1], from[2] - this.entries[entry + 2]);
            const jump = source.costOverride >= 0 ? source.costOverride : Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) * filter.areaCosts[source.area];
            const cost = this.costs[polygon] + approach * filter.areaCosts[areas[polygon]] + jump;
            this.relax(edge.toPolygon, polygon, NO_PORTAL, edge, cost, to[0], to[1], to[2], end);
        }
    }
    private trace(last: number, isComplete: boolean): NavCorridor {
        const polygons: number[] = [];
        const portals: number[] = [];
        const links: (NavLinkEdge | null)[] = [];
        for (let polygon = last; polygon !== NO_POLYGON; polygon = this.parents[polygon]) {
            polygons.push(polygon);
            portals.push(this.portals[polygon]);
            links.push(this.links[polygon]);
        }
        return { polygons: polygons.reverse(), portals: portals.reverse(), links: links.reverse(), isComplete };
    }
}
