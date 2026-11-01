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
}
