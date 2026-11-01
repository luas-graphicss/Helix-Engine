import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import type { Vec3 } from '@/engine/core/math/vec3';
import { Entity } from '@/engine/core/scene/entity';
import { Terrain, TERRAIN_RESOLUTIONS, type TerrainHit } from '@/engine/terrain/core/terrain';
import { createRegion, type GridRegion } from '@/engine/terrain/core/heightfield';
import { createTerrainLayer, cloneTerrainLayer, type TerrainLayer } from '@/engine/terrain/core/terrain-layer';
import { createGenerationParams, generateTerrainHeights, TERRAIN_PRESETS, type TerrainGenerationParams } from '@/engine/terrain/generation/terrain-generator';
import { autoPaintTerrain } from '@/engine/terrain/generation/auto-paint';
import { BRUSH_FALLOFFS, createBrushSettings, type BrushFalloff, type BrushSettings } from '@/engine/terrain/sculpt/brush';
import { erodeThermal, sculptFlatten, sculptNoise, sculptRaise, sculptSmooth, sculptTerrace, type Stamp } from '@/engine/terrain/sculpt/sculpt-tools';
import { paintLayer } from '@/engine/terrain/sculpt/paint-tool';
import { paintGrass } from '@/engine/terrain/foliage/grass-paint-tool';
import { sampleWaterSurface, createWaterSample } from '@/engine/terrain/water/water-surface';
import { addTerrainLayer, moveTerrainLayer, removeTerrainLayer, regenerateTerrain, resizeTerrain } from '@/engine/editor/operations/terrain-operations';
import { HelixArgumentError, HelixError, HelixNotImplementedError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireFunction, requireNumber, requireObject, requireOneOf, requireString, toVec3 } from '../runtime/values';
import type { SceneApi } from './scene';
const SCULPT_TOOLS = ['raise', 'lower', 'smooth', 'flatten', 'noise', 'terrace'] as const;
const FALLOFF_IDS: readonly BrushFalloff[] = BRUSH_FALLOFFS.map((entry) => entry.value);
type TerrainResolution = (typeof TERRAIN_RESOLUTIONS)[number];
function requireResolution(value: unknown, member: string): TerrainResolution {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric === 'number' && (TERRAIN_RESOLUTIONS as readonly number[]).includes(numeric))
        return numeric as TerrainResolution;
    throw new HelixArgumentError(member, `resolution precisa ser ${TERRAIN_RESOLUTIONS.join(', ')}; recebido ${typeof value === 'number' || typeof value === 'string' ? String(value) : typeof value}.`);
}
const inverseWorld = mat4.create();
const localPoint = vec3.create();
const localDirection = vec3.create();
const worldRotation = quat.create();
const scratchHit: TerrainHit = { distance: 0, point: vec3.create() };
const scratchRegion = createRegion();
const scratchWater = createWaterSample();
export function createTerrainApi(host: RuntimeHost, sceneApi: SceneApi) {
    const { session } = host;
    const { scene } = session;
    function resolve(value: unknown, member: string): {
        entity: Entity;
        terrain: Terrain;
    } {
        if (value instanceof Entity) {
            if (!value.terrain)
                throw new HelixArgumentError(member, `${value.name} não tem componente de terreno.`);
            return { entity: value, terrain: value.terrain };
        }
        if (value === undefined || value === null) {
            const first = firstTerrain();
            if (!first)
                throw new HelixError(`${member}: a cena não tem terreno; crie um com helix.terrain.spawn().`);
            return first;
        }
        throw new HelixArgumentError(member, 'esperava um ator com terreno (ou nada, para o primeiro terreno da cena).');
    }
    function firstTerrain(): {
        entity: Entity;
        terrain: Terrain;
    } | null {
        let found: {
            entity: Entity;
            terrain: Terrain;
        } | null = null;
        scene.traverse((entity) => {
            if (!found && entity.terrain)
                found = { entity, terrain: entity.terrain };
        });
        return found;
    }
    function toLocal(entity: Entity, point: Vec3, out: Vec3): Vec3 | null {
        scene.updateWorldMatrices();
        if (!mat4.invert(inverseWorld, entity.worldMatrix))
            return null;
        return mat4.transformPoint(out, inverseWorld, point);
    }
    function worldHeight(entity: Entity, localHeight: number): number {
        return entity.worldMatrix[13] + localHeight;
    }
    function brushOf(value: unknown, member: string): BrushSettings {
        if (value === undefined || value === null)
            return createBrushSettings();
        const options = requireObject(value, member, 'o pincel');
        return createBrushSettings({
            radius: options.radius === undefined ? undefined : requireNumber(options.radius, member, 'radius'),
            strength: options.strength === undefined ? undefined : requireNumber(options.strength, member, 'strength'),
            falloff: options.falloff === undefined ? undefined : requireOneOf(options.falloff, FALLOFF_IDS, member, 'falloff'),
        });
    }
    function stampAt(terrain: Terrain, local: Vec3, brush: BrushSettings): Stamp {
        return { cx: terrain.localToGrid(local[0]), cz: terrain.localToGrid(local[2]), radius: brush.radius / terrain.cellSize, falloff: brush.falloff as BrushFalloff, region: createRegion() };
    }
    function regionOf(value: unknown, member: string): GridRegion | null {
        if (value === undefined || value === null)
            return null;
        const r = requireObject(value, member, 'a região');
        return createRegion(requireNumber(r.x0, member, 'x0'), requireNumber(r.z0, member, 'z0'), requireNumber(r.x1, member, 'x1'), requireNumber(r.z1, member, 'z1'));
    }
    const materials = {
        catalog: () => session.terrain.materials.list(),
        get: (id: unknown) => session.terrain.materials.get(requireString(id, 'helix.terrain.materials.get', 'o id do material')),
        has: (id: unknown) => session.terrain.materials.has(requireString(id, 'helix.terrain.materials.has', 'o id do material')),
        fromLibrary: (id: unknown) => {
            const material = session.terrain.materials.get(requireString(id, 'helix.terrain.materials.fromLibrary', 'o id do material'));
            if (!material)
                throw new HelixArgumentError('helix.terrain.materials.fromLibrary', `material "${String(id)}" não existe. Catálogo: ${session.terrain.materials.list().map((entry) => entry.id).join(', ')}.`);
            return material;
        },
        fromTextures: () => {
            throw new HelixNotImplementedError('helix.terrain.materials.fromTextures', 'materiais de terreno a partir de texturas soltas ainda não são criados por script; importe pelo painel Terreno.');
        },
    };
    const water = {
        settingsOf: (value: unknown) => resolve(value, 'helix.terrain.water.settingsOf').terrain.water,
        set: (value: unknown, patch: unknown) => {
            const { terrain } = resolve(value, 'helix.terrain.water.set');
            assignSettings(terrain.water as unknown as Record<string, unknown>, patch, 'helix.terrain.water.set', { colors: new Set(['shallowColor', 'deepColor']) });
            session.notify();
        },
        sampleSurface: (value: unknown, x: unknown, z: unknown, time?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.water.sampleSurface');
            vec3.set(localPoint, requireNumber(x, 'helix.terrain.water.sampleSurface', 'x'), 0, requireNumber(z, 'helix.terrain.water.sampleSurface', 'z'));
            toLocal(entity, localPoint, localPoint);
            sampleWaterSurface(scratchWater, terrain.water, terrain.size, localPoint[0], localPoint[2], time === undefined ? host.time.now : requireNumber(time, 'helix.terrain.water.sampleSurface', 'o tempo'));
            return { height: worldHeight(entity, scratchWater.height), normal: vec3.copy(vec3.create(), scratchWater.normal), velocity: vec3.copy(vec3.create(), scratchWater.velocity) };
        },
        isUnderwater: (point: unknown, value?: unknown) => {
            const p = toVec3(point, 'helix.terrain.water.isUnderwater');
            const { entity, terrain } = resolve(value, 'helix.terrain.water.isUnderwater');
            if (!terrain.water.enabled || !toLocal(entity, p, localPoint) || !terrain.containsLocal(localPoint[0], localPoint[2]))
                return false;
            sampleWaterSurface(scratchWater, terrain.water, terrain.size, localPoint[0], localPoint[2], host.time.now);
            return p[1] < worldHeight(entity, scratchWater.height);
        },
        depthAt: (point: unknown, value?: unknown) => {
            const p = toVec3(point, 'helix.terrain.water.depthAt');
            const { entity, terrain } = resolve(value, 'helix.terrain.water.depthAt');
            if (!terrain.water.enabled || !toLocal(entity, p, localPoint) || !terrain.containsLocal(localPoint[0], localPoint[2]))
                return 0;
            sampleWaterSurface(scratchWater, terrain.water, terrain.size, localPoint[0], localPoint[2], host.time.now);
            return Math.max(0, worldHeight(entity, scratchWater.height) - p[1]);
        },
    };
    const grass = {
        settingsOf: (value: unknown) => resolve(value, 'helix.terrain.grass.settingsOf').terrain.grass,
        set: (value: unknown, patch: unknown) => {
            const { terrain } = resolve(value, 'helix.terrain.grass.set');
            assignSettings(terrain.grass as unknown as Record<string, unknown>, patch, 'helix.terrain.grass.set', { colors: new Set(['baseColor', 'tipColor']) });
            terrain.grassChanged();
            session.notify();
        },
        paint: (value: unknown, point: unknown, brush?: unknown, amount: unknown = 1) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.grass.paint');
            if (!toLocal(entity, toVec3(point, 'helix.terrain.grass.paint'), localPoint))
                return;
            const settings = brushOf(brush, 'helix.terrain.grass.paint');
            paintGrass(terrain, localPoint[0], localPoint[2], settings.radius, settings.falloff as BrushFalloff, requireNumber(amount, 'helix.terrain.grass.paint', 'a quantidade') * settings.strength, scratchRegion);
        },
        addInteractor: () => {
            throw new HelixNotImplementedError('helix.terrain.grass.addInteractor', 'interatores manuais ainda não são registrados; personagens e corpos em movimento já amassam a grama sozinhos.');
        },
    };
    return {
        all: () => {
            const result: Entity[] = [];
            scene.traverse((entity) => {
                if (entity.terrain)
                    result.push(entity);
            });
            return result;
        },
        first: () => firstTerrain()?.entity ?? null,
        of: (value: unknown) => resolve(value, 'helix.terrain.of').terrain,
        spawn: (options?: unknown, parent?: unknown) => {
            const extra = options === undefined ? {} : requireObject(options, 'helix.terrain.spawn');
            const terrainOptions = extra.terrain && typeof extra.terrain === 'object' ? (extra.terrain as Record<string, unknown>) : extra;
            const size = terrainOptions.size === undefined ? undefined : requireNumber(terrainOptions.size, 'helix.terrain.spawn', 'size');
            const terrain = new Terrain({ size, resolution: terrainOptions.resolution === undefined ? undefined : requireResolution(terrainOptions.resolution, 'helix.terrain.spawn') });
            const entity = sceneApi.spawn('terrain', { name: typeof extra.name === 'string' ? extra.name : 'Terreno', position: extra.position, rotation: extra.rotation, terrain }, parent);
            if (terrainOptions.generate && typeof terrainOptions.generate === 'object') {
                generateTerrainHeights(terrain.heightfield, terrain.size, createGenerationParams(terrainOptions.generate as Partial<TerrainGenerationParams>));
                terrain.heightsChanged();
            }
            return entity;
        },
        presets: () => TERRAIN_PRESETS.slice(),
        resolutions: () => TERRAIN_RESOLUTIONS.slice(),
        heightAt: (point: unknown, value?: unknown) => {
            const p = toVec3(point, 'helix.terrain.heightAt');
            const { entity, terrain } = resolve(value, 'helix.terrain.heightAt');
            if (!toLocal(entity, p, localPoint) || !terrain.containsLocal(localPoint[0], localPoint[2]))
                return null;
            return worldHeight(entity, terrain.heightAtLocal(localPoint[0], localPoint[2]));
        },
        normalAt: (point: unknown, value?: unknown) => {
            const p = toVec3(point, 'helix.terrain.normalAt');
            const { entity, terrain } = resolve(value, 'helix.terrain.normalAt');
            if (!toLocal(entity, p, localPoint) || !terrain.containsLocal(localPoint[0], localPoint[2]))
                return null;
            const normal = terrain.normalAtLocal(vec3.create(), localPoint[0], localPoint[2]);
            quat.fromMat4Rotation(worldRotation, entity.worldMatrix);
            return quat.rotateVec3(normal, worldRotation, normal);
        },
        contains: (point: unknown, value?: unknown) => {
            const p = toVec3(point, 'helix.terrain.contains');
            const { entity, terrain } = resolve(value, 'helix.terrain.contains');
            return Boolean(toLocal(entity, p, localPoint) && terrain.containsLocal(localPoint[0], localPoint[2]));
        },
        raycast: (origin: unknown, direction: unknown, value?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.raycast');
            const o = toVec3(origin, 'helix.terrain.raycast');
            const d = vec3.normalize(vec3.create(), toVec3(direction, 'helix.terrain.raycast'));
            if (!toLocal(entity, o, localPoint))
                return null;
            mat4.invert(inverseWorld, entity.worldMatrix);
            mat4.transformDirection(localDirection, inverseWorld, d);
            const hit = terrain.raycast(localPoint, localDirection, scratchHit);
            if (!hit)
                return null;
            const point = vec3.scaleAndAdd(vec3.create(), o, d, hit.distance);
            return { entity, point, distance: hit.distance };
        },
        worldToGrid: (point: unknown, value?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.worldToGrid');
            if (!toLocal(entity, toVec3(point, 'helix.terrain.worldToGrid'), localPoint))
                return null;
            return { gx: terrain.localToGrid(localPoint[0]), gz: terrain.localToGrid(localPoint[2]) };
        },
        gridToWorld: (gx: unknown, gz: unknown, value?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.gridToWorld');
            const x = terrain.gridToLocal(requireNumber(gx, 'helix.terrain.gridToWorld', 'gx'));
            const z = terrain.gridToLocal(requireNumber(gz, 'helix.terrain.gridToWorld', 'gz'));
            vec3.set(localPoint, x, terrain.heightAtLocal(x, z), z);
            scene.updateWorldMatrices();
            return mat4.transformPoint(vec3.create(), entity.worldMatrix, localPoint);
        },
        markDirty: (value: unknown, region?: unknown) => {
            const { terrain } = resolve(value, 'helix.terrain.markDirty');
            terrain.heightsChanged(regionOf(region, 'helix.terrain.markDirty'));
            session.playtest.physics?.reconcile();
        },
        generate: (value: unknown, params?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.generate');
            const resolved = createGenerationParams(params === undefined ? {} : (requireObject(params, 'helix.terrain.generate') as Partial<TerrainGenerationParams>));
            if (host.mode === 'editor') {
                regenerateTerrain(session, entity, resolved);
            }
            else {
                generateTerrainHeights(terrain.heightfield, terrain.size, resolved);
                terrain.heightsChanged();
                session.playtest.physics?.reconcile();
            }
        },
        generateWith: (value: unknown, fnValue: unknown) => {
            const { terrain } = resolve(value, 'helix.terrain.generateWith');
            const fn = requireFunction<(u: number, v: number, x: number, z: number) => number>(fnValue, 'helix.terrain.generateWith', 'a função de altura');
            const { heightfield } = terrain;
            const { resolution } = heightfield;
            for (let z = 0; z < resolution; z++) {
                for (let x = 0; x < resolution; x++) {
                    const u = x / (resolution - 1);
                    const v = z / (resolution - 1);
                    const height = fn(u, v, terrain.gridToLocal(x), terrain.gridToLocal(z));
                    heightfield.set(x, z, Number.isFinite(height) ? height : 0);
                }
            }
            terrain.heightsChanged();
            session.playtest.physics?.reconcile();
        },
        fill: (value: unknown, height: unknown = 0) => {
            const { terrain } = resolve(value, 'helix.terrain.fill');
            terrain.heightfield.fill(requireNumber(height, 'helix.terrain.fill', 'a altura'));
            terrain.heightsChanged();
            session.playtest.physics?.reconcile();
        },
        autoPaint: (value: unknown) => {
            const { terrain } = resolve(value, 'helix.terrain.autoPaint');
            const changed = autoPaintTerrain(terrain);
            session.notify();
            return changed;
        },
        resize: (value: unknown, patch: unknown) => {
            const { entity } = resolve(value, 'helix.terrain.resize');
            if (host.mode !== 'editor')
                throw new HelixError('helix.terrain.resize só vale no modo editor: em jogo redimensionar o terreno recria todos os seus dados.');
            resizeTerrain(session, entity, requireObject(patch, 'helix.terrain.resize') as Parameters<typeof resizeTerrain>[2]);
        },
        brush: (options?: unknown) => brushOf(options, 'helix.terrain.brush'),
        falloffs: () => FALLOFF_IDS.slice(),
        tools: () => SCULPT_TOOLS.slice(),
        sculpt: (value: unknown, toolValue: unknown, point: unknown, brush?: unknown, amount: unknown = 1, extra?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.sculpt');
            const tool = requireOneOf(toolValue, SCULPT_TOOLS, 'helix.terrain.sculpt', 'a ferramenta');
            if (!toLocal(entity, toVec3(point, 'helix.terrain.sculpt'), localPoint))
                return;
            const settings = brushOf(brush, 'helix.terrain.sculpt');
            const stamp = stampAt(terrain, localPoint, settings);
            const strength = requireNumber(amount, 'helix.terrain.sculpt', 'a quantidade') * settings.strength;
            const options = extra === undefined ? {} : requireObject(extra, 'helix.terrain.sculpt', 'as opções da ferramenta');
            const { heightfield } = terrain;
            switch (tool) {
                case 'raise':
                    sculptRaise(heightfield, stamp, strength);
                    break;
                case 'lower':
                    sculptRaise(heightfield, stamp, -strength);
                    break;
                case 'smooth':
                    sculptSmooth(heightfield, stamp, Math.min(1, Math.abs(strength)));
                    break;
                case 'flatten':
                    sculptFlatten(heightfield, stamp, options.target === undefined ? localPoint[1] - entity.worldMatrix[13] : requireNumber(options.target, 'helix.terrain.sculpt', 'target'), Math.min(1, Math.abs(strength)));
                    break;
                case 'noise':
                    sculptNoise(heightfield, stamp, strength, options.scaleCells === undefined ? 8 : requireNumber(options.scaleCells, 'helix.terrain.sculpt', 'scaleCells'), options.seed === undefined ? 1 : requireNumber(options.seed, 'helix.terrain.sculpt', 'seed'));
                    break;
                case 'terrace':
                    sculptTerrace(heightfield, stamp, options.step === undefined ? 2 : requireNumber(options.step, 'helix.terrain.sculpt', 'step'), Math.min(1, Math.abs(strength)));
                    break;
            }
            terrain.heightsChanged(stamp.region);
            session.playtest.physics?.reconcile();
        },
        erode: (value: unknown, region?: unknown, talusSlope: unknown = 0.8, amount: unknown = 0.5) => {
            const { terrain } = resolve(value, 'helix.terrain.erode');
            const r = regionOf(region, 'helix.terrain.erode') ?? createRegion(0, 0, terrain.resolution - 1, terrain.resolution - 1);
            erodeThermal(terrain.heightfield, r, terrain.cellSize, requireNumber(talusSlope, 'helix.terrain.erode', 'a inclinação limite'), requireNumber(amount, 'helix.terrain.erode', 'a quantidade'));
            terrain.heightsChanged(r);
            session.playtest.physics?.reconcile();
        },
        layers: (value?: unknown) => resolve(value, 'helix.terrain.layers').terrain.layers,
        addLayer: (value: unknown, materialId: unknown, overrides?: unknown): TerrainLayer | null => {
            const { entity, terrain } = resolve(value, 'helix.terrain.addLayer');
            const id = requireString(materialId, 'helix.terrain.addLayer', 'o id do material');
            if (host.mode === 'editor') {
                const layer = addTerrainLayer(session, entity, id);
                if (layer && overrides !== undefined)
                    assignSettings(layer as unknown as Record<string, unknown>, overrides, 'helix.terrain.addLayer', { allowUnknown: false, colors: new Set(['tint']) });
                return layer;
            }
            if (!terrain.canAddLayer)
                return null;
            const material = materials.fromLibrary(id);
            const layer = createTerrainLayer(material);
            if (overrides !== undefined)
                assignSettings(layer as unknown as Record<string, unknown>, overrides, 'helix.terrain.addLayer', { colors: new Set(['tint']) });
            terrain.layers.push(layer);
            terrain.markSplatDirty();
            session.notify();
            return layer;
        },
        removeLayer: (value: unknown, layerValue: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.removeLayer');
            const index = typeof layerValue === 'number' ? layerValue : terrain.layers.indexOf(layerValue as TerrainLayer);
            const layer = terrain.layers[index];
            if (!layer)
                throw new HelixArgumentError('helix.terrain.removeLayer', 'camada não encontrada neste terreno.');
            if (host.mode === 'editor') {
                removeTerrainLayer(session, entity, layer);
                return;
            }
            terrain.layers.splice(index, 1);
            terrain.markSplatDirty();
            session.notify();
        },
        moveLayer: (value: unknown, layerValue: unknown, direction: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.moveLayer');
            const index = typeof layerValue === 'number' ? layerValue : terrain.layers.indexOf(layerValue as TerrainLayer);
            const layer = terrain.layers[index];
            if (!layer)
                throw new HelixArgumentError('helix.terrain.moveLayer', 'camada não encontrada neste terreno.');
            const dir = requireNumber(direction, 'helix.terrain.moveLayer', 'a direção (-1 ou 1)') < 0 ? -1 : 1;
            if (host.mode === 'editor') {
                moveTerrainLayer(session, entity, layer, dir);
                return;
            }
            const target = index + dir;
            if (target < 0 || target >= terrain.layers.length)
                return;
            terrain.layers.splice(index, 1);
            terrain.layers.splice(target, 0, layer);
            terrain.markSplatDirty();
            session.notify();
        },
        cloneLayer: (layer: unknown) => cloneTerrainLayer(requireObject(layer, 'helix.terrain.cloneLayer', 'a camada') as unknown as TerrainLayer),
        paint: (value: unknown, point: unknown, layerValue: unknown, brush?: unknown, amount: unknown = 1) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.paint');
            const index = typeof layerValue === 'number' ? layerValue : terrain.layers.indexOf(layerValue as TerrainLayer);
            if (index < 0 || index >= terrain.layers.length)
                throw new HelixArgumentError('helix.terrain.paint', 'camada não encontrada neste terreno.');
            if (!toLocal(entity, toVec3(point, 'helix.terrain.paint'), localPoint))
                return;
            const settings = brushOf(brush, 'helix.terrain.paint');
            paintLayer(terrain, localPoint[0], localPoint[2], settings.radius, settings.falloff as BrushFalloff, index, requireNumber(amount, 'helix.terrain.paint', 'a quantidade') * settings.strength, scratchRegion);
        },
        weightsAt: (point: unknown, value?: unknown) => {
            const { entity, terrain } = resolve(value, 'helix.terrain.weightsAt');
            if (!toLocal(entity, toVec3(point, 'helix.terrain.weightsAt'), localPoint))
                return null;
            const tx = Math.round(terrain.localToSplat(localPoint[0]));
            const tz = Math.round(terrain.localToSplat(localPoint[2]));
            return terrain.layers.map((_, layer) => terrain.splat.weight(tx, tz, layer));
        },
        materials,
        water,
        grass,
        shadingOf: (value?: unknown) => resolve(value, 'helix.terrain.shadingOf').terrain.shading,
        scatter: () => {
            throw new HelixNotImplementedError('helix.terrain.scatter', 'espalhar vegetação por densidade ainda não existe; crie instâncias com helix.scene.spawnModel em um laço com helix.terrain.heightAt.');
        },
        stitch: () => {
            throw new HelixNotImplementedError('helix.terrain.stitch', 'costura de terrenos vizinhos ainda não existe.');
        },
        fromImage: () => {
            throw new HelixNotImplementedError('helix.terrain.fromImage', 'importar heightmap por imagem ainda não é exposto; use generateWith com helix.assets.data.');
        },
        onRegionChanged: () => {
            throw new HelixNotImplementedError('helix.terrain.onRegionChanged', 'leia terrain.heightVersion por frame por enquanto.');
        },
    };
}
export type { Stamp };
