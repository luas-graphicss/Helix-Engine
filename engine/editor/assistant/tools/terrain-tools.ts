import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import { addTerrain, flattenTerrain, regenerateTerrain, setWaterEnabled, updateWaterSettings } from '@/engine/editor/operations/terrain-operations';
import { commitTransform, snapshotTransform } from '@/engine/editor/operations/transform-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { createGenerationParams, TERRAIN_PRESETS, type TerrainGenerationParams } from '@/engine/terrain/generation/terrain-generator';
import type { AssistantTool } from './assistant-tool';
import { requireActor } from './entity-access';
import { summarizeEntity } from './entity-summary';
import { ToolFailure } from './tool-failure';
import type { ToolInput } from './tool-input';
import { choice, flag, integer, number, parameters } from './tool-parameters';
import { POSITION_PARAMETER, transformFrom } from './transform-input';
const MIN_TERRAIN_SIZE = 16;
const MAX_TERRAIN_SIZE = 4096;
const PRESET_IDS = TERRAIN_PRESETS.map((preset) => preset.value);
const GENERATION_SCALARS = ['seed', 'amplitude', 'featureSize', 'detail', 'erosion'] as const satisfies readonly (keyof TerrainGenerationParams)[];
const TERRAIN_ID_PARAMETER = integer('Id of the terrain entity.');
const GENERATION_PARAMETERS = {
    preset: choice('Landform to generate.', PRESET_IDS),
    seed: integer('Random seed. Change it for a different layout of the same landform.'),
    amplitude: number('Height range in meters, 1 to 200.'),
    featureSize: number('Horizontal size of the landforms in meters, 10 to 600.'),
    detail: number('Fine detail, 0 to 1.'),
    erosion: integer('Erosion passes, 0 to 20.'),
};
const WATER_PARAMETERS = {
    water: flag('Turn the water plane of the terrain on or off.'),
    waterLevel: number('Water height in meters, in terrain space.'),
};
function readGeneration(input: ToolInput): Partial<TerrainGenerationParams> {
    const patch: Partial<TerrainGenerationParams> = {};
    const preset = input.optionalChoice('preset', PRESET_IDS);
    if (preset)
        patch.preset = preset;
    for (const key of GENERATION_SCALARS) {
        const value = input.optionalNumber(key);
        if (value !== undefined)
            patch[key] = value;
    }
    return patch;
}
function requireTerrain(session: EditorSession, id: number): Entity {
    const entity = requireActor(session, id);
    if (!entity.terrain)
        throw new ToolFailure(`${entity.name} is not a terrain.`);
    return entity;
}
function applyWater(session: EditorSession, entity: Entity, input: ToolInput): void {
    const enabled = input.optionalFlag('water');
    if (enabled !== undefined)
        setWaterEnabled(session, entity, enabled);
    const level = input.optionalNumber('waterLevel');
    if (level !== undefined)
        updateWaterSettings(session, entity, { level });
}
const createTerrain: AssistantTool = {
    name: 'create_terrain',
    title: 'Criar terreno',
    access: 'scene',
    description: 'Adds a generated terrain with automatic material painting. Its origin is the center of the terrain.',
    parameters: parameters({
        size: number(`Side length in meters, ${MIN_TERRAIN_SIZE} to ${MAX_TERRAIN_SIZE}. Default 200.`),
        position: POSITION_PARAMETER,
        ...GENERATION_PARAMETERS,
        ...WATER_PARAMETERS,
    }),
    run(session, input) {
        const size = input.optionalNumber('size');
        const activeTool = session.tool;
        session.terrain.updateGeneration(readGeneration(input));
        const entity = addTerrain(session, size === undefined ? {} : { size: clamp(size, MIN_TERRAIN_SIZE, MAX_TERRAIN_SIZE) });
        session.setTool(activeTool);
        const before = snapshotTransform(entity);
        const after = transformFrom(entity, input);
        if (after)
            commitTransform(session, entity, before, after, `Posicionar ${entity.name}`);
        applyWater(session, entity, input);
        return summarizeEntity(entity);
    },
};
const reshapeTerrain: AssistantTool = {
    name: 'reshape_terrain',
    title: 'Gerar relevo',
    access: 'scene',
    description: 'Regenerates the heights of an existing terrain. Omitted settings keep the values of the last generation.',
    parameters: parameters({ id: TERRAIN_ID_PARAMETER, ...GENERATION_PARAMETERS }, ['id']),
    run(session, input) {
        const entity = requireTerrain(session, input.integer('id'));
        const params = createGenerationParams({ ...session.terrain.generation, ...readGeneration(input) });
        regenerateTerrain(session, entity, params);
        return `${entity.name} regenerated as ${params.preset} with seed ${params.seed}.`;
    },
};
const flattenTerrainTool: AssistantTool = {
    name: 'flatten_terrain',
    title: 'Aplainar terreno',
    access: 'scene',
    description: 'Sets the whole terrain to a single height.',
    parameters: parameters({ id: TERRAIN_ID_PARAMETER, height: number('Height in meters. Default 0.') }, ['id']),
    run(session, input) {
        const entity = requireTerrain(session, input.integer('id'));
        const height = input.optionalNumber('height') ?? 0;
        flattenTerrain(session, entity, height);
        return `${entity.name} flattened at ${height} m.`;
    },
};
const setTerrainWater: AssistantTool = {
    name: 'set_terrain_water',
    title: 'Alterar água do terreno',
    access: 'scene',
    description: 'Turns the water of a terrain on or off and sets its level.',
    parameters: parameters({ id: TERRAIN_ID_PARAMETER, ...WATER_PARAMETERS }, ['id']),
    run(session, input) {
        const entity = requireTerrain(session, input.integer('id'));
        applyWater(session, entity, input);
        return summarizeEntity(entity);
    },
};
export const TERRAIN_TOOLS: readonly AssistantTool[] = [createTerrain, reshapeTerrain, flattenTerrainTool, setTerrainWater];
