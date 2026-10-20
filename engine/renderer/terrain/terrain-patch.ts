import { TILE_CELLS, TILE_LEVELS } from '@/engine/terrain/chunks/terrain-tiles';
export const ATTRIB_PATCH = 0;
export const ATTRIB_TILE_ORIGIN = 1;
export const STITCH_NORTH = 1;
export const STITCH_EAST = 2;
export const STITCH_SOUTH = 4;
export const STITCH_WEST = 8;
export const STITCH_VARIANTS = 16;
const TILE_VERTICES = TILE_CELLS + 1;
export interface PatchRange {
    readonly first: number;
    readonly count: number;
}
export interface TerrainPatch {
    readonly vertices: Float32Array;
    readonly indices: Uint16Array;
    readonly ranges: readonly PatchRange[];
}
export function patchRangeIndex(level: number, stitchMask: number): number {
    return level * STITCH_VARIANTS + stitchMask;
}
function vertexAt(i: number, j: number): number {
    return j * TILE_VERTICES + i;
}
function resolveCorner(cx: number, cz: number, cells: number, step: number, mask: number): number {
    let x = cx;
    let z = cz;
    if (cx & 1) {
        if (cz === 0 && mask & STITCH_NORTH)
            x = cx - 1;
        else if (cz === cells && mask & STITCH_SOUTH)
            x = cx - 1;
    }
    if (cz & 1) {
        if (cx === 0 && mask & STITCH_WEST)
            z = cz - 1;
        else if (cx === cells && mask & STITCH_EAST)
            z = cz - 1;
    }
    return vertexAt(x * step, z * step);
}
function pushTriangle(out: number[], a: number, b: number, c: number): void {
    if (a !== b && b !== c && a !== c)
        out.push(a, b, c);
}
export function buildTerrainPatch(): TerrainPatch {
    const vertices = new Float32Array(TILE_VERTICES * TILE_VERTICES * 2);
    for (let j = 0; j < TILE_VERTICES; j++) {
        for (let i = 0; i < TILE_VERTICES; i++) {
            const index = vertexAt(i, j) * 2;
            vertices[index] = i;
            vertices[index + 1] = j;
        }
    }
    const indices: number[] = [];
    const ranges: PatchRange[] = [];
    for (let level = 0; level < TILE_LEVELS; level++) {
        const step = 1 << level;
        const cells = TILE_CELLS >> level;
        for (let variant = 0; variant < STITCH_VARIANTS; variant++) {
            const mask = cells > 1 ? variant : 0;
            const first = indices.length;
            for (let cz = 0; cz < cells; cz++) {
                for (let cx = 0; cx < cells; cx++) {
                    const p00 = resolveCorner(cx, cz, cells, step, mask);
                    const p10 = resolveCorner(cx + 1, cz, cells, step, mask);
                    const p01 = resolveCorner(cx, cz + 1, cells, step, mask);
                    const p11 = resolveCorner(cx + 1, cz + 1, cells, step, mask);
                    const dropped00or11 = p00 !== vertexAt(cx * step, cz * step) || p11 !== vertexAt((cx + 1) * step, (cz + 1) * step);
                    const dropped10or01 = p10 !== vertexAt((cx + 1) * step, cz * step) || p01 !== vertexAt(cx * step, (cz + 1) * step);
                    let diagonalFrom00 = (cx + cz) % 2 === 1;
                    if (dropped00or11)
                        diagonalFrom00 = false;
                    else if (dropped10or01)
                        diagonalFrom00 = true;
                    if (diagonalFrom00) {
                        pushTriangle(indices, p00, p01, p11);
                        pushTriangle(indices, p00, p11, p10);
                    }
                    else {
                        pushTriangle(indices, p00, p01, p10);
                        pushTriangle(indices, p01, p11, p10);
                    }
                }
            }
            ranges.push({ first, count: indices.length - first });
        }
    }
    return { vertices, indices: new Uint16Array(indices), ranges };
}
