import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { ALL_AREAS_MASK, areaBit, areaCostTable, createNavigationSettings, JUMP_AREA, WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { bakeNavMesh, type NavBakeSettings } from '@/engine/navigation/bake/bake-nav-mesh';
import type { NavAreaVolume } from '@/engine/navigation/bake/filter-cells';
import { TriangleSoupBuilder } from '@/engine/navigation/bake/triangle-soup';
import { NO_CELL } from '@/engine/navigation/mesh/nav-cells';
import type { NavLinkSource } from '@/engine/navigation/mesh/nav-link';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { attachLinks } from '@/engine/navigation/mesh/nav-mesh-links';
import { findCellAt } from '@/engine/navigation/mesh/nav-mesh-queries';
import { CorridorSearch } from '@/engine/navigation/path/corridor-search';
import { findPath } from '@/engine/navigation/path/find-path';
import type { NavPath } from '@/engine/navigation/path/nav-path';
import type { NavQueryFilter } from '@/engine/navigation/path/nav-query-filter';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const SETTINGS: NavBakeSettings = { agentRadius: 0.5, agentHeight: 2, maxSlope: 45, stepHeight: 0.4, cellSize: 0.25, minRegionArea: 2 };
const SNAP_DISTANCE = 2;
const MUD_AREA = 3;
const MUD_COST = 10;
const MUD_HALF_WIDTH = 2;
const MUD_END = 6;
const EDGE_SLACK = 0.1;
const SAMPLE_SPACING = 0.1;
const checks = createCheckList('Caminhos no NavMesh');
const search = new CorridorSearch();
const world = mat4.create();
const NO_ROTATION = vec3.create();
const UNIT_SCALE = vec3.create(1, 1, 1);
const defaultCosts = areaCostTable(createNavigationSettings());
const everywhere: NavQueryFilter = { areaMask: ALL_AREAS_MASK, areaCosts: defaultCosts };
function addBox(soup: TriangleSoupBuilder, size: readonly [number, number, number], center: readonly [number, number, number]): void {
    mat4.fromTranslationRotationScale(world, vec3.create(center[0], center[1], center[2]), NO_ROTATION, UNIT_SCALE);
    soup.addMesh(createBox(size[0], size[1], size[2]), world, WALKABLE_AREA);
}
function bake(soup: TriangleSoupBuilder, areaVolumes: readonly NavAreaVolume[] = []): NavMesh {
    const mesh = bakeNavMesh({ triangles: soup, heightSources: [], areaVolumes, minX: soup.min[0], maxX: soup.max[0], minZ: soup.min[2], maxZ: soup.max[2], minHeight: -Infinity, maxHeight: Infinity }, SETTINGS);
    if (!mesh)
        throw new Error('The bake produced no walkable polygon.');
    return mesh;
}
function route(mesh: NavMesh, from: Vec3, to: Vec3, filter = everywhere): NavPath {
    return findPath(mesh, search, from, to, filter, SNAP_DISTANCE);
}
function everySample(path: NavPath, accepts: (x: number, y: number, z: number) => boolean): boolean {
    for (let index = 1; index < path.corners.length; index++) {
        if (path.links[index - 1])
            continue;
        const from = path.corners[index - 1];
        const to = path.corners[index];
        const samples = Math.ceil(vec3.distance(from, to) / SAMPLE_SPACING);
        for (let sample = 1; sample < samples; sample++) {
            const blend = sample / samples;
            if (!accepts(from[0] + (to[0] - from[0]) * blend, from[1] + (to[1] - from[1]) * blend, from[2] + (to[2] - from[2]) * blend))
                return false;
        }
    }
    return true;
}
function staysOnMesh(mesh: NavMesh, path: NavPath): boolean {
    return everySample(path, (x, y, z) => findCellAt(mesh, x, y, z, 0.5) !== NO_CELL);
}
function farthestZ(path: NavPath): number {
    return path.corners.reduce((farthest, corner) => Math.max(farthest, corner[2]), -Infinity);
}
const openFloor = new TriangleSoupBuilder();
addBox(openFloor, [20, 1, 20], [0, -0.5, 0]);
const open = bake(openFloor);
const diagonal = route(open, vec3.create(-8, 0, -8), vec3.create(8, 0, 8));
checks.check('piso livre resolve o caminho', diagonal.status === 'complete');
checks.check('caminho em piso livre é uma reta', diagonal.corners.length === 2, `${diagonal.corners.length} cantos`);
checks.near('comprimento da reta é a distância entre os pontos', diagonal.length, Math.hypot(16, 16), 0.01);
checks.check('destino fora do alcance do NavMesh invalida o caminho', route(open, vec3.create(0, 0, 0), vec3.create(40, 0, 0)).status === 'invalid');
const walled = new TriangleSoupBuilder();
addBox(walled, [20, 1, 20], [0, -0.5, 0]);
addBox(walled, [1, 3, 12], [0, 1.5, 0]);
const wall = bake(walled);
const around = route(wall, vec3.create(-5, 0, 0), vec3.create(5, 0, 0));
checks.check('caminho contorna a parede', around.status === 'complete' && around.corners.length >= 4, `${around.corners.length} cantos`);
checks.check('contorno é o mais curto pela ponta da parede', around.length > 16 && around.length < 20, `${around.length.toFixed(2)} m`);
checks.check('todo o caminho fica sobre o NavMesh', staysOnMesh(wall, around));
const offset = route(wall, vec3.create(-5, 0, -4), vec3.create(5, 0, -4));
checks.check('caminho escolhe a ponta da parede mais próxima', farthestZ(offset) < 0, `z máximo ${farthestZ(offset).toFixed(2)}`);
function mudBand(minZ: number, maxZ: number): NavAreaVolume {
    const inverseWorld = mat4.create();
    mat4.identity(inverseWorld);
    return { inverseWorld, center: vec3.create(0, 0, (minZ + maxZ) / 2), halfSize: vec3.create(MUD_HALF_WIDTH, 1, (maxZ - minZ) / 2), minX: -MUD_HALF_WIDTH, maxX: MUD_HALF_WIDTH, minZ, maxZ, area: MUD_AREA };
}
function avoidsMud(path: NavPath): boolean {
    return everySample(path, (x, _y, z) => Math.abs(x) > MUD_HALF_WIDTH - EDGE_SLACK || z > MUD_END - EDGE_SLACK);
}
const costly = new Float32Array(defaultCosts);
costly[MUD_AREA] = MUD_COST;
const mud = bake(openFloor, [mudBand(-10, MUD_END)]);
const through = route(mud, vec3.create(-6, 0, -6), vec3.create(6, 0, -6));
const detour = route(mud, vec3.create(-6, 0, -6), vec3.create(6, 0, -6), { areaMask: ALL_AREAS_MASK, areaCosts: costly });
const forbidden = route(mud, vec3.create(-6, 0, -6), vec3.create(6, 0, -6), { areaMask: ALL_AREAS_MASK & ~areaBit(MUD_AREA), areaCosts: defaultCosts });
checks.check('área de custo igual é atravessada em reta', through.corners.length === 2 && through.status === 'complete');
checks.check('área cara faz o caminho desviar pela passagem livre', detour.status === 'complete' && avoidsMud(detour), `z máximo ${farthestZ(detour).toFixed(2)}`);
checks.check('área fora da máscara do agente nunca é pisada', forbidden.status === 'complete' && avoidsMud(forbidden) && staysOnMesh(mud, forbidden));
const sealed = bake(openFloor, [mudBand(-10, 10)]);
const blocked = route(sealed, vec3.create(-6, 0, 0), vec3.create(6, 0, 0), { areaMask: ALL_AREAS_MASK & ~areaBit(MUD_AREA), areaCosts: defaultCosts });
const lastReachable = blocked.corners[blocked.corners.length - 1];
checks.check('destino inalcançável devolve caminho parcial', blocked.status === 'partial');
checks.check('caminho parcial para na borda mais próxima do destino', Math.abs(lastReachable[0] + MUD_HALF_WIDTH) < EDGE_SLACK, `x ${lastReachable[0].toFixed(2)}`);
const islands = new TriangleSoupBuilder();
addBox(islands, [9, 1, 10], [-5.5, -0.5, 0]);
addBox(islands, [9, 1, 10], [5.5, -0.5, 0]);
const bridge: NavLinkSource = { id: 1, start: vec3.create(-2, 0, 0), end: vec3.create(2, 0, 0), bidirectional: true, costOverride: -1, area: JUMP_AREA };
const gap = bake(islands);
checks.check('ilhas sem link ficam inalcançáveis entre si', route(gap, vec3.create(-6, 0, 0), vec3.create(6, 0, 0)).status === 'partial');
attachLinks(gap, [bridge], SNAP_DISTANCE);
const jump = route(gap, vec3.create(-6, 0, 3), vec3.create(6, 0, -3));
const linkCorner = jump.links.findIndex((link) => link !== null);
checks.check('link fora da malha conecta as duas ilhas', jump.status === 'complete' && linkCorner !== -1);
checks.check('o caminho entra e sai pelo link', linkCorner !== -1 && Math.abs(jump.corners[linkCorner][0] + 2) < 0.2 && Math.abs(jump.corners[linkCorner + 1][0] - 2) < 0.2);
checks.check('link bidirecional funciona na volta', route(gap, vec3.create(6, 0, 0), vec3.create(-6, 0, 0)).status === 'complete');
checks.check('agente sem a área do link na máscara não o atravessa', route(gap, vec3.create(-6, 0, 0), vec3.create(6, 0, 0), { areaMask: ALL_AREAS_MASK & ~areaBit(JUMP_AREA), areaCosts: defaultCosts }).status === 'partial');
attachLinks(gap, [{ ...bridge, bidirectional: false }], SNAP_DISTANCE);
checks.check('link de mão única não funciona na volta', route(gap, vec3.create(6, 0, 0), vec3.create(-6, 0, 0)).status === 'partial');
checks.check('link de mão única funciona na ida', route(gap, vec3.create(-6, 0, 0), vec3.create(6, 0, 0)).status === 'complete');
checks.finish();
