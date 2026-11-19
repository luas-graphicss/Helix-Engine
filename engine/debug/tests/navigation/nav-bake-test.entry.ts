import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { NOT_WALKABLE_AREA, WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { bakeNavMesh, type NavBakeInput, type NavBakeSettings } from '@/engine/navigation/bake/bake-nav-mesh';
import type { NavAreaVolume } from '@/engine/navigation/bake/filter-cells';
import type { NavHeightSource } from '@/engine/navigation/bake/rasterize-height-source';
import { TriangleSoupBuilder } from '@/engine/navigation/bake/triangle-soup';
import { NO_POLYGON, polygonHeight } from '@/engine/navigation/mesh/build-polygons';
import { NO_CELL } from '@/engine/navigation/mesh/nav-cells';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { findCellAt, findNearestCell, sampleHeight } from '@/engine/navigation/mesh/nav-mesh-queries';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const SETTINGS: NavBakeSettings = { agentRadius: 0.5, agentHeight: 2, maxSlope: 45, stepHeight: 0.4, cellSize: 0.25, minRegionArea: 2 };
const FLOOR_SIZE = 20;
const FLOOR_THICKNESS = 1;
const CUSTOM_AREA = 3;
const REACH = 0.3;
const checks = createCheckList('Geração do NavMesh');
const world = mat4.create();
const NO_ROTATION = vec3.create();
const UNIT_SCALE = vec3.create(1, 1, 1);
function addBox(soup: TriangleSoupBuilder, size: readonly [number, number, number], center: readonly [number, number, number], rotation = NO_ROTATION): void {
    mat4.fromTranslationRotationScale(world, vec3.create(center[0], center[1], center[2]), rotation, UNIT_SCALE);
    soup.addMesh(createBox(size[0], size[1], size[2]), world, WALKABLE_AREA);
}
function addFloor(soup: TriangleSoupBuilder): void {
    addBox(soup, [FLOOR_SIZE, FLOOR_THICKNESS, FLOOR_SIZE], [0, -FLOOR_THICKNESS / 2, 0]);
}
function inputOf(soup: TriangleSoupBuilder, extras: Partial<NavBakeInput> = {}): NavBakeInput {
    return { triangles: soup, heightSources: [], areaVolumes: [], minX: soup.min[0], maxX: soup.max[0], minZ: soup.min[2], maxZ: soup.max[2], minHeight: -Infinity, maxHeight: Infinity, ...extras };
}
function bake(soup: TriangleSoupBuilder, extras: Partial<NavBakeInput> = {}): NavMesh {
    const mesh = bakeNavMesh(inputOf(soup, extras), SETTINGS);
    if (!mesh)
        throw new Error('The bake produced no walkable polygon.');
    return mesh;
}
function isWalkableAt(mesh: NavMesh, x: number, y: number, z: number): boolean {
    return findCellAt(mesh, x, y, z, REACH) !== NO_CELL;
}
function heightAt(mesh: NavMesh, x: number, z: number): number {
    const rough = findNearestCell(mesh, x, 0, z, 1);
    const cell = rough === NO_CELL ? NO_CELL : findCellAt(mesh, x, mesh.cells.heights[rough], z, 1);
    return cell === NO_CELL ? Number.NaN : sampleHeight(mesh, cell, x, z);
}
function polygonAt(mesh: NavMesh, x: number, y: number, z: number): number {
    const cell = findCellAt(mesh, x, y, z, REACH);
    return cell === NO_CELL ? NO_POLYGON : mesh.polygonOf(cell);
}
function isReachable(mesh: NavMesh, from: number, to: number): boolean {
    const { portalStart, portalTarget, count } = mesh.polygons;
    const visited = new Uint8Array(count);
    const pending = [from];
    visited[from] = 1;
    for (let polygon = pending.pop(); polygon !== undefined; polygon = pending.pop()) {
        if (polygon === to)
            return true;
        for (let portal = portalStart[polygon]; portal < portalStart[polygon + 1]; portal++) {
            const target = portalTarget[portal];
            if (visited[target] === 0) {
                visited[target] = 1;
                pending.push(target);
            }
        }
    }
    return false;
}
const openFloor = new TriangleSoupBuilder();
addFloor(openFloor);
const open = bake(openFloor);
checks.check('piso livre vira um único polígono', open.polygons.count === 1, `${open.polygons.count} polígonos`);
checks.near('área caminhável desconta o raio do agente nas bordas', open.walkableArea, 19 * 19, 1e-3);
checks.check('centro do piso é caminhável', isWalkableAt(open, 0, 0, 0));
checks.check('faixa do raio do agente junto à borda fica fora', !isWalkableAt(open, 9.8, 0, 0));
checks.near('polígono fica na altura do piso', polygonHeight(open.polygons, 0, 3, -4), 0, 1e-4);
const walled = new TriangleSoupBuilder();
addFloor(walled);
addBox(walled, [1, 3, 6], [0, 1.5, 0]);
const wall = bake(walled);
checks.check('parede abre um buraco no NavMesh', !isWalkableAt(wall, 0, 0, 0));
checks.check('margem do raio do agente em volta da parede fica fora', !isWalkableAt(wall, 1, 0, 0));
checks.check('piso além da margem da parede segue caminhável', isWalkableAt(wall, 1.6, 0, 0));
checks.check('topo estreito da parede não vira área caminhável', !isWalkableAt(wall, 0, 3, 0));
checks.check('os dois lados da parede se ligam contornando-a', isReachable(wall, polygonAt(wall, -3, 0, 0), polygonAt(wall, 3, 0, 0)));
const gentle = new TriangleSoupBuilder();
addBox(gentle, [6, 0.2, 10], [0, 0, 0], vec3.create(20, 0, 0));
const ramp = bake(gentle);
checks.check('rampa de 20° é caminhável', isWalkableAt(ramp, 0, heightAt(ramp, 0, 0), 0));
checks.near('altura amostrada acompanha a inclinação da rampa', Math.abs(heightAt(ramp, 0, 1) - heightAt(ramp, 0, 0)), Math.tan(20 * Math.PI / 180), 0.02);
const steep = new TriangleSoupBuilder();
addBox(steep, [6, 0.2, 10], [0, 0, 0], vec3.create(60, 0, 0));
checks.check('rampa de 60° passa do limite de inclinação', bakeNavMesh(inputOf(steep), SETTINGS) === null);
const covered = new TriangleSoupBuilder();
addFloor(covered);
addBox(covered, [10, 0.2, 10], [0, 1.1, 0]);
const ceiling = bake(covered);
checks.check('piso sob teto baixo não é caminhável', !isWalkableAt(ceiling, 0, 0, 0));
checks.check('laje acima do teto baixo é caminhável', isWalkableAt(ceiling, 0, 1.2, 0));
checks.check('piso fora do teto baixo segue caminhável', isWalkableAt(ceiling, 8, 0, 8));
const stepped = new TriangleSoupBuilder();
addFloor(stepped);
addBox(stepped, [4, 0.3, 4], [-5, 0.15, 0]);
addBox(stepped, [4, 0.8, 4], [5, 0.4, 0]);
const steps = bake(stepped);
const ground = polygonAt(steps, 0, 0, 8);
checks.check('degrau de 0,3 m liga com o piso', isReachable(steps, ground, polygonAt(steps, -5, 0.3, 0)));
checks.check('plataforma de 0,8 m fica isolada do piso', polygonAt(steps, 5, 0.8, 0) !== NO_POLYGON && !isReachable(steps, ground, polygonAt(steps, 5, 0.8, 0)));
function volumeAt(x: number, z: number, area: number): NavAreaVolume {
    mat4.fromTranslationRotationScale(world, vec3.create(x, 0, z), NO_ROTATION, UNIT_SCALE);
    const inverseWorld = mat4.create();
    mat4.invert(inverseWorld, world);
    return { inverseWorld, center: vec3.create(), halfSize: vec3.create(2, 1, 2), minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2, area };
}
const zoned = new TriangleSoupBuilder();
addFloor(zoned);
const zones = bake(zoned, { areaVolumes: [volumeAt(5, 5, CUSTOM_AREA), volumeAt(-5, -5, NOT_WALKABLE_AREA)] });
checks.check('volume pinta a área nos polígonos dentro dele', zones.polygons.areas[polygonAt(zones, 5, 0, 5)] === CUSTOM_AREA);
checks.check('piso fora do volume mantém a área padrão', zones.polygons.areas[polygonAt(zones, 0, 0, 0)] === WALKABLE_AREA);
checks.check('volume não caminhável remove o piso', !isWalkableAt(zones, -5, 0, -5));
const hill: NavHeightSource = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, area: WALKABLE_AREA, heightAt: (x) => 0.1 * x, normalYAt: () => 0.995 };
const terrain = bakeNavMesh({ triangles: new TriangleSoupBuilder(), heightSources: [hill], areaVolumes: [], minX: -10, maxX: 10, minZ: -10, maxZ: 10, minHeight: -Infinity, maxHeight: Infinity }, SETTINGS);
checks.check('terreno amostrado por altura gera NavMesh', terrain !== null);
if (terrain)
    checks.near('altura sobre o terreno segue o relevo', heightAt(terrain, 3.1, 2), 0.31, 0.01);
checks.check('faixa de altura do volume descarta o piso fora dela', bakeNavMesh(inputOf(openFloor, { minHeight: 0.5, maxHeight: 5 }), SETTINGS) === null);
checks.finish();
