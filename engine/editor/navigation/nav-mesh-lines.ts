import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { BOUNDS_FLOATS, polygonHeight } from '@/engine/navigation/mesh/build-polygons';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { DebugLineBuffer } from './debug-line-buffer';
export const NAV_AREA_COLORS: readonly Vec3[] = [
    vec3.create(0.2, 0.65, 1),
    vec3.create(0.9, 0.25, 0.2),
    vec3.create(1, 0.6, 0.15),
    vec3.create(0.35, 0.85, 0.45),
    vec3.create(0.85, 0.5, 0.9),
    vec3.create(0.95, 0.85, 0.3),
    vec3.create(0.3, 0.85, 0.85),
    vec3.create(0.95, 0.5, 0.6),
];
const SURFACE_LIFT = 0.04;
const OUTLINE_ALPHA = 0.75;
const QUAD_CORNERS = 4;
const quad: Vec3[] = Array.from({ length: QUAD_CORNERS }, () => vec3.create());
function setCorner(mesh: NavMesh, polygon: number, corner: Vec3, x: number, z: number): void {
    vec3.set(corner, x, polygonHeight(mesh.polygons, polygon, x, z) + SURFACE_LIFT, z);
}
export function buildNavMeshLines(mesh: NavMesh): DebugLineBuffer {
    const { bounds, areas, count } = mesh.polygons;
    const buffer = new DebugLineBuffer();
    for (let polygon = 0; polygon < count; polygon++) {
        const bound = polygon * BOUNDS_FLOATS;
        const color = NAV_AREA_COLORS[areas[polygon]];
        setCorner(mesh, polygon, quad[0], bounds[bound], bounds[bound + 1]);
        setCorner(mesh, polygon, quad[1], bounds[bound + 2], bounds[bound + 1]);
        setCorner(mesh, polygon, quad[2], bounds[bound + 2], bounds[bound + 3]);
        setCorner(mesh, polygon, quad[3], bounds[bound], bounds[bound + 3]);
        for (let corner = 0; corner < QUAD_CORNERS; corner++)
            buffer.segment(quad[corner], quad[(corner + 1) % QUAD_CORNERS], color, OUTLINE_ALPHA);
    }
    return buffer;
}
