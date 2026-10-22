import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Command } from '@/engine/editor/history/command';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { AddLayerCommand, GrassSnapshotCommand, HeightsRegionCommand, RemoveLayerCommand, ReplaceTerrainDataCommand, SplatSnapshotCommand, SwapLayersCommand, } from '@/engine/editor/commands/terrain-commands';
import { Terrain, TERRAIN_RESOLUTIONS, TERRAIN_SPLAT_RESOLUTIONS } from '@/engine/terrain/core/terrain';
import type { GridRegion } from '@/engine/terrain/core/heightfield';
import { createAutoRule, createTerrainLayer, type TerrainAutoRule, type TerrainLayer } from '@/engine/terrain/core/terrain-layer';
import type { TerrainShading } from '@/engine/terrain/core/terrain-shading';
import { assignGrassSettings, cloneGrassSettings, type GrassSettings } from '@/engine/terrain/foliage/grass-settings';
import { materialSupportsGrass } from '@/engine/terrain/foliage/grass-placement';
import { assignWaterSettings, cloneWaterSettings, type WaterSettings, type WaterSettingsPatch } from '@/engine/terrain/water/water-settings';
import type { WaterFoamSettings } from '@/engine/terrain/water/water-foam-settings';
import { autoPaintTerrain } from '@/engine/terrain/generation/auto-paint';
import { generateTerrainHeights, type TerrainGenerationParams, type TerrainPreset } from '@/engine/terrain/generation/terrain-generator';
import type { CustomMaterialMaps, TerrainMaterialLibrary } from '@/engine/terrain/materials/terrain-material-library';
import { addEntity, defaultParent, spawnPosition } from './entity-operations';
export type LayerScalarKey = 'tiling' | 'normalStrength' | 'roughness';
export interface TerrainSizing {
    size: number;
    resolution: number;
    splatResolution: number;
}
const DEFAULT_TERRAIN_SIZE = 200;
const DEFAULT_RESOLUTION: (typeof TERRAIN_RESOLUTIONS)[number] = 257;
const DEFAULT_SPLAT_RESOLUTION: (typeof TERRAIN_SPLAT_RESOLUTIONS)[number] = 512;
interface StarterLayer {
    materialId: string;
    auto?: Partial<TerrainAutoRule>;
}
const STARTER_LAYERS: Record<TerrainPreset, readonly StarterLayer[]> = {
    flat: [{ materialId: 'grass' }],
    hills: [
        { materialId: 'grass' },
        { materialId: 'meadow', auto: { enabled: true, slopeMin: 0, slopeMax: 22, heightMin: 0.45, heightMax: 1, softness: 0.4 } },
        { materialId: 'dirt', auto: { enabled: true, slopeMin: 17, slopeMax: 36, softness: 0.3 } },
        { materialId: 'rock', auto: { enabled: true, slopeMin: 33, slopeMax: 90, softness: 0.25 } },
    ],
    mountains: [
        { materialId: 'grass' },
        { materialId: 'gravel', auto: { enabled: true, slopeMin: 18, slopeMax: 40, heightMin: 0, heightMax: 0.7, softness: 0.3 } },
        { materialId: 'rock', auto: { enabled: true, slopeMin: 34, slopeMax: 90, softness: 0.2 } },
        { materialId: 'snow', auto: { enabled: true, slopeMin: 0, slopeMax: 42, heightMin: 0.62, heightMax: 1, softness: 0.3 } },
    ],
    valley: [
        { materialId: 'grass' },
        { materialId: 'mud', auto: { enabled: true, slopeMin: 0, slopeMax: 20, heightMin: 0.3, heightMax: 0.8, softness: 0.35 } },
        { materialId: 'gravel', auto: { enabled: true, slopeMin: 0, slopeMax: 14, heightMin: 0, heightMax: 0.12, softness: 0.25 } },
        { materialId: 'rock', auto: { enabled: true, slopeMin: 36, slopeMax: 90, softness: 0.2 } },
    ],
    islands: [
        { materialId: 'sand' },
        { materialId: 'grass', auto: { enabled: true, slopeMin: 0, slopeMax: 30, heightMin: 0.3, heightMax: 1, softness: 0.3 } },
        { materialId: 'rock', auto: { enabled: true, slopeMin: 32, slopeMax: 90, softness: 0.2 } },
    ],
    plateau: [
        { materialId: 'meadow' },
        { materialId: 'dirt', auto: { enabled: true, slopeMin: 0, slopeMax: 10, heightMin: 0, heightMax: 0.2, softness: 0.25 } },
        { materialId: 'rock', auto: { enabled: true, slopeMin: 30, slopeMax: 90, softness: 0.15 } },
    ],
    dunes: [{ materialId: 'sand' }, { materialId: 'meadow', auto: { enabled: true, slopeMin: 0, slopeMax: 12, heightMin: 0, heightMax: 0.25, softness: 0.3 } }],
};
function fullRegion(resolution: number): GridRegion {
    return { x0: 0, z0: 0, x1: resolution - 1, z1: resolution - 1 };
}
function heightsCommand(label: string, terrain: Terrain, mutate: () => void): HeightsRegionCommand {
    const { heightfield } = terrain;
    const region = fullRegion(heightfield.resolution);
    const before = new Float32Array(heightfield.heights);
    mutate();
    const after = new Float32Array(heightfield.heights);
    return new HeightsRegionCommand(label, terrain, heightfield, region, before, after);
}
function splatCommand(label: string, terrain: Terrain, mutate: () => boolean): SplatSnapshotCommand | null {
    const before = terrain.splat.clone();
    if (!mutate())
        return null;
    return new SplatSnapshotCommand(label, terrain, terrain.splat, before, terrain.splat.clone());
}
function hasAutoRules(terrain: Terrain): boolean {
    return terrain.layers.some((layer) => layer.auto.enabled);
}
export function createStarterLayers(library: TerrainMaterialLibrary, preset: TerrainPreset): TerrainLayer[] {
    const layers: TerrainLayer[] = [];
    for (const starter of STARTER_LAYERS[preset]) {
        const material = library.get(starter.materialId);
        if (material)
            layers.push(createTerrainLayer(material, { auto: createAutoRule(starter.auto) }));
    }
    return layers;
}
export function addTerrain(session: EditorSession, sizing: Partial<TerrainSizing> = {}): Entity {
    const params = session.terrain.generation;
    const terrain = new Terrain({
        size: sizing.size ?? DEFAULT_TERRAIN_SIZE,
        resolution: sizing.resolution ?? DEFAULT_RESOLUTION,
        splatResolution: sizing.splatResolution ?? DEFAULT_SPLAT_RESOLUTION,
        layers: createStarterLayers(session.terrain.materials, params.preset),
    });
    generateTerrainHeights(terrain.heightfield, terrain.size, params);
    terrain.heightsChanged();
    autoPaintTerrain(terrain);
    const entity = session.scene.createEntity({ name: 'Terreno', kind: 'terrain', terrain }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    addEntity(session, entity, defaultParent(session), 'Adicionar terreno');
    session.terrain.setActiveLayer(terrain.layers[0]?.id ?? null);
    session.setTool('terrain');
    return entity;
}
export function regenerateTerrain(session: EditorSession, entity: Entity, params: TerrainGenerationParams): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    const commands: Command[] = [heightsCommand('Gerar relevo', terrain, () => generateTerrainHeights(terrain.heightfield, terrain.size, params))];
    if (hasAutoRules(terrain)) {
        const paint = splatCommand('Pintura automática', terrain, () => autoPaintTerrain(terrain));
        if (paint)
            commands.push(paint);
    }
    session.history.execute(new CompositeCommand('Gerar relevo', commands));
    session.log.info('Terreno', `Relevo "${params.preset}" gerado em ${entity.name} (semente ${params.seed}).`);
}
export function flattenTerrain(session: EditorSession, entity: Entity, height = 0): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    session.history.execute(heightsCommand('Aplainar terreno', terrain, () => terrain.heightfield.fill(height)));
}
export function autoPaint(session: EditorSession, entity: Entity): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    const command = splatCommand('Pintura automática', terrain, () => autoPaintTerrain(terrain));
    if (!command) {
        session.log.warn('Terreno', 'Nenhuma camada tem regra automática ativa. Ative "Automático" em uma camada para pintar por inclinação e altura.');
        return;
    }
    session.history.execute(command);
}
export function fillTerrainLayer(session: EditorSession, entity: Entity, layer: TerrainLayer): void {
    const { terrain } = entity;
    const index = terrain?.layerIndex(layer.id) ?? -1;
    if (!terrain || index === -1)
        return;
    const command = splatCommand(`Preencher com ${layer.name}`, terrain, () => {
        terrain.splat.fillLayer(index);
        terrain.markSplatDirty();
        return true;
    });
    if (command)
        session.history.execute(command);
}
export function resizeTerrain(session: EditorSession, entity: Entity, patch: Partial<TerrainSizing>): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    const resolution = patch.resolution ?? terrain.resolution;
    const splatResolution = patch.splatResolution ?? terrain.splat.resolution;
    const size = patch.size ?? terrain.size;
    if (resolution === terrain.resolution && splatResolution === terrain.splat.resolution && size === terrain.size)
        return;
    const before = { heightfield: terrain.heightfield, splat: terrain.splat, grassMap: terrain.grassMap, size: terrain.size };
    const after = {
        heightfield: resolution === terrain.resolution ? terrain.heightfield : terrain.heightfield.resampled(resolution),
        splat: splatResolution === terrain.splat.resolution ? terrain.splat : terrain.splat.resampled(splatResolution),
        grassMap: splatResolution === terrain.grassMap.resolution ? terrain.grassMap : terrain.grassMap.resampled(splatResolution),
        size,
    };
    session.history.execute(new ReplaceTerrainDataCommand('Redimensionar terreno', terrain, before, after));
    session.log.info('Terreno', `${entity.name}: ${size} m, ${resolution}² vértices, controle ${splatResolution}².`);
}
export function addTerrainLayer(session: EditorSession, entity: Entity, materialId: string): TerrainLayer | null {
    const { terrain } = entity;
    if (!terrain)
        return null;
    if (!terrain.canAddLayer) {
        session.log.warn('Terreno', `Um terreno comporta no máximo ${terrain.layers.length} camadas.`);
        return null;
    }
    const material = session.terrain.materials.get(materialId);
    if (!material)
        return null;
    const layer = createTerrainLayer(material);
    session.history.execute(new AddLayerCommand(terrain, layer));
    session.terrain.setActiveLayer(layer.id);
    return layer;
}
export function removeTerrainLayer(session: EditorSession, entity: Entity, layer: TerrainLayer): void {
    const { terrain } = entity;
    const index = terrain?.layerIndex(layer.id) ?? -1;
    if (!terrain || index === -1)
        return;
    session.history.execute(new RemoveLayerCommand(terrain, layer, index));
    if (session.terrain.activeLayerId === layer.id)
        session.terrain.setActiveLayer(terrain.layers[0]?.id ?? null);
}
export function moveTerrainLayer(session: EditorSession, entity: Entity, layer: TerrainLayer, direction: -1 | 1): void {
    const { terrain } = entity;
    const index = terrain?.layerIndex(layer.id) ?? -1;
    if (!terrain || index === -1)
        return;
    const target = index + direction;
    if (target < 0 || target >= terrain.layers.length)
        return;
    session.history.execute(new SwapLayersCommand(terrain, index, target));
}
export function setLayerScalar(session: EditorSession, layer: TerrainLayer, key: LayerScalarKey, value: number): void {
    if (!Number.isFinite(value) || layer[key] === value)
        return;
    session.history.execute(new SetValueCommand(`Camada ${layer.name}: ${key}`, (next) => {
        layer[key] = next;
    }, layer[key], value, `terrain-layer-${layer.id}-${key}`));
}
export function setLayerTint(session: EditorSession, layer: TerrainLayer, tint: Vec3): void {
    session.history.execute(new SetValueCommand(`Camada ${layer.name}: tonalidade`, (value) => vec3.copy(layer.tint, value), vec3.copy(vec3.create(), layer.tint), vec3.copy(vec3.create(), tint), `terrain-layer-${layer.id}-tint`));
}
export function renameLayer(session: EditorSession, layer: TerrainLayer, name: string): void {
    const next = name.trim();
    if (!next || next === layer.name)
        return;
    session.history.execute(new SetValueCommand(`Renomear camada para ${next}`, (value) => {
        layer.name = value;
    }, layer.name, next));
}
export function updateLayerAutoRule(session: EditorSession, layer: TerrainLayer, patch: Partial<TerrainAutoRule>): void {
    session.history.execute(new SetValueCommand(`Camada ${layer.name}: regra automática`, (value) => Object.assign(layer.auto, value), { ...layer.auto }, { ...layer.auto, ...patch }, `terrain-layer-${layer.id}-auto`));
}
export function updateTerrainShading(session: EditorSession, entity: Entity, patch: Partial<TerrainShading>): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    session.history.execute(new SetValueCommand('Sombreamento do terreno', (value) => Object.assign(terrain.shading, value), { ...terrain.shading }, { ...terrain.shading, ...patch }, `terrain-shading-${entity.id}`));
}
export function updateGrassSettings(session: EditorSession, entity: Entity, patch: Partial<GrassSettings>): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    const after = cloneGrassSettings(terrain.grass);
    assignGrassSettings(after, patch);
    session.history.execute(new SetValueCommand('Grama do terreno', (value) => assignGrassSettings(terrain.grass, value), cloneGrassSettings(terrain.grass), after, `terrain-grass-${entity.id}`));
}
export function terrainSupportsGrass(terrain: Terrain): boolean {
    return terrain.layers.some((layer) => materialSupportsGrass(layer.material));
}
export function fillGrass(session: EditorSession, entity: Entity, density: number): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    if (density > 0 && !terrainSupportsGrass(terrain)) {
        session.log.warn('Terreno', 'Nenhuma camada aceita grama. Adicione uma camada de vegetação ou de terra antes de cobrir o terreno.');
        return;
    }
    const before = terrain.grassMap.clone();
    terrain.grassMap.fill(density);
    terrain.grassChanged();
    const label = density > 0 ? 'Cobrir o terreno com grama' : 'Limpar grama';
    session.history.execute(new GrassSnapshotCommand(label, terrain, terrain.grassMap, before, terrain.grassMap.clone()));
}
export function updateWaterSettings(session: EditorSession, entity: Entity, patch: WaterSettingsPatch, label = 'Água do terreno'): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    const after = cloneWaterSettings(terrain.water);
    assignWaterSettings(after, patch);
    session.history.execute(new SetValueCommand(label, (value) => assignWaterSettings(terrain.water, value), cloneWaterSettings(terrain.water), after, `terrain-water-${entity.id}`));
}
export function updateWaterFoam(session: EditorSession, entity: Entity, patch: Partial<WaterFoamSettings>): void {
    updateWaterSettings(session, entity, { foam: patch }, 'Espuma da água');
}
export function setWaterFoamEnabled(session: EditorSession, entity: Entity, enabled: boolean): void {
    updateWaterFoam(session, entity, { enabled });
    session.history.endMerge();
}
export function setWaterEnabled(session: EditorSession, entity: Entity, enabled: boolean): void {
    const { terrain } = entity;
    if (!terrain)
        return;
    const { minHeight, maxHeight } = terrain.tiles;
    const patch: Partial<WaterSettings> = { enabled };
    if (enabled && (terrain.water.level <= minHeight || terrain.water.level >= maxHeight)) {
        patch.level = Math.round((minHeight + (maxHeight - minHeight) * 0.33) * 10) / 10;
    }
    updateWaterSettings(session, entity, patch);
    session.history.endMerge();
}
export type CustomMaterialFiles = Partial<Record<keyof CustomMaterialMaps, File>>;
export async function importTerrainMaterial(session: EditorSession, name: string, files: CustomMaterialFiles): Promise<string | null> {
    const maps: CustomMaterialMaps = { albedo: null, normal: null, roughness: null, occlusion: null, height: null };
    for (const key of Object.keys(maps) as Array<keyof CustomMaterialMaps>) {
        const file = files[key];
        if (!file)
            continue;
        try {
            maps[key] = await decodeImage(file, file.type || mimeTypeFromFileName(file.name));
        }
        catch (cause) {
            session.log.error('Terreno', `Não foi possível decodificar "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`);
            return null;
        }
    }
    if (!maps.albedo) {
        session.log.warn('Terreno', 'Um material de terreno precisa ao menos do mapa de cor (albedo).');
        return null;
    }
    const material = session.terrain.materials.createCustom(name.trim() || 'Material', maps);
    session.log.info('Terreno', `Material "${material.name}" criado a partir de ${Object.values(files).filter(Boolean).length} mapa(s).`);
    return material.id;
}
