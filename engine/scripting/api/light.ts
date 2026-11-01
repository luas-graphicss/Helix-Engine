import * as vec3 from '@/engine/core/math/vec3';
import { Entity } from '@/engine/core/scene/entity';
import { cloneLight, convertLocalLight, createAmbientLight, createDirectionalLight, createLocalLight, effectiveLightRange, isLocalLight, LOCAL_LIGHT_TYPES, MAX_LIGHT_TEMPERATURE, MIN_LIGHT_TEMPERATURE, resolveLocalLightColor, temperatureToLinearRgb, type Light, type LocalLightType, } from '@/engine/core/scene/light';
import { LIGHT_PRESETS, getLightPreset, type LightPresetId } from '@/engine/core/scene/light-presets';
import { collectLights, lightCssColor } from '@/engine/editor/lights/light-catalog';
import { syncSunLightToSky } from '@/engine/core/environment/sky-cycle';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireNumber, requireObject, requireOneOf, requireString, toLinearColor } from '../runtime/values';
import type { SceneApi } from './scene';
const LIGHT_TYPES = ['directional', 'ambient', ...LOCAL_LIGHT_TYPES] as const;
const LIGHT_COLOR_FIELDS: ReadonlySet<string> = new Set(['color', 'skyColor', 'groundColor']);
export function createLightApi(host: RuntimeHost, sceneApi: SceneApi) {
    const { session } = host;
    const { scene } = session;
    function create(typeValue: unknown, options?: unknown): Light {
        const type = requireOneOf(typeValue, LIGHT_TYPES, 'helix.light.create', 'o tipo de luz');
        const light: Light = type === 'directional' ? createDirectionalLight() : type === 'ambient' ? createAmbientLight() : createLocalLight(type as LocalLightType);
        if (options !== undefined && options !== null)
            assignSettings(light as unknown as Record<string, unknown>, options, 'helix.light.create', { colors: LIGHT_COLOR_FIELDS });
        return light;
    }
    function resolve(value: unknown, member: string): {
        entity: Entity | null;
        light: Light;
    } {
        if (value instanceof Entity) {
            if (!value.light)
                throw new HelixArgumentError(member, `${value.name} não tem componente de luz.`);
            return { entity: value, light: value.light };
        }
        if (value && typeof value === 'object' && typeof (value as {
            type?: unknown;
        }).type === 'string')
            return { entity: null, light: value as Light };
        throw new HelixArgumentError(member, 'esperava um ator com luz ou um objeto de luz (helix.light.create).');
    }
    function presetId(value: unknown, member: string): LightPresetId {
        const id = requireString(value, member, 'o id do preset');
        if (!LIGHT_PRESETS.some((preset) => preset.id === id))
            throw new HelixArgumentError(member, `preset "${id}" desconhecido. Presets: ${LIGHT_PRESETS.map((preset) => preset.id).join(', ')}.`);
        return id as LightPresetId;
    }
    return {
        types: () => LIGHT_TYPES.slice(),
        localTypes: () => LOCAL_LIGHT_TYPES.slice(),
        create,
        clone: (value: unknown) => cloneLight(resolve(value, 'helix.light.clone').light),
        fromPreset: (id: unknown) => getLightPreset(presetId(id, 'helix.light.fromPreset')).create(),
        presets: () => LIGHT_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, description: preset.description, type: preset.type })),
        spawn: (typeOrPreset: unknown, options?: unknown, parent?: unknown) => {
            const extra = options && typeof options === 'object' ? (options as Record<string, unknown>) : {};
            const { light: lightOptions, ...rest } = extra;
            const isPreset = typeof typeOrPreset === 'string' && !(LIGHT_TYPES as readonly string[]).includes(typeOrPreset);
            const light = isPreset ? getLightPreset(presetId(typeOrPreset, 'helix.light.spawn')).create() : create(typeOrPreset, lightOptions);
            if (isPreset && lightOptions !== undefined)
                assignSettings(light as unknown as Record<string, unknown>, lightOptions, 'helix.light.spawn', { colors: LIGHT_COLOR_FIELDS });
            return sceneApi.spawn('light', { name: typeof typeOrPreset === 'string' ? `Luz ${typeOrPreset}` : 'Luz', ...rest, light }, parent);
        },
        set: (value: unknown, patch: unknown) => {
            const { entity, light } = resolve(value, 'helix.light.set');
            assignSettings(light as unknown as Record<string, unknown>, patch, 'helix.light.set', { colors: LIGHT_COLOR_FIELDS });
            if (entity)
                session.notifyLiveEdit();
        },
        convert: (value: unknown, typeValue: unknown) => {
            const entity = requireEntity(value, 'helix.light.convert');
            if (!entity.light || !isLocalLight(entity.light))
                throw new HelixArgumentError('helix.light.convert', `${entity.name} não tem uma luz local para converter.`);
            const type = requireOneOf(typeValue, LOCAL_LIGHT_TYPES, 'helix.light.convert', 'o tipo');
            entity.light = convertLocalLight(entity.light, type);
            session.notify();
            return entity.light;
        },
        all: (query?: unknown) => {
            const filter = query === undefined || query === null ? {} : requireObject(query, 'helix.light.all', 'o filtro');
            const type = filter.type === undefined ? null : requireOneOf(filter.type, LIGHT_TYPES, 'helix.light.all', 'type');
            const local = filter.local === undefined ? null : Boolean(filter.local);
            const catalog = collectLights(scene);
            return [...catalog.global, ...catalog.local]
                .filter(({ light }) => (type === null || light.type === type) && (local === null || isLocalLight(light) === local))
                .map(({ entity, light }) => ({ entity, light }));
        },
        sun: () => {
            let found: Entity | null = null;
            scene.traverse((entity) => {
                if (!found && entity.light?.type === 'directional')
                    found = entity;
            });
            return found;
        },
        ambient: () => {
            let found: Entity | null = null;
            scene.traverse((entity) => {
                if (!found && entity.light?.type === 'ambient')
                    found = entity;
            });
            return found;
        },
        syncSunToSky: () => syncSunLightToSky(scene),
        get driveSun() {
            return session.skyDrivesSun;
        },
        set driveSun(value: boolean) {
            session.skyDrivesSun = Boolean(value);
        },
        isLocal: (value: unknown) => isLocalLight(resolve(value, 'helix.light.isLocal').light),
        effectiveRange: (value: unknown) => {
            const { light } = resolve(value, 'helix.light.effectiveRange');
            return isLocalLight(light) ? effectiveLightRange(light) : Infinity;
        },
        resolvedColor: (value: unknown) => {
            const { light } = resolve(value, 'helix.light.resolvedColor');
            if (!isLocalLight(light))
                return vec3.copy(vec3.create(), (light as {
                    color: vec3.Vec3;
                }).color);
            return resolveLocalLightColor(vec3.create(), light);
        },
        temperatureToColor: (kelvin: unknown) => temperatureToLinearRgb(vec3.create(), requireNumber(kelvin, 'helix.light.temperatureToColor', 'a temperatura em Kelvin')),
        setTemperature: (target: unknown, kelvin: unknown) => {
            const { light } = resolve(target, 'helix.light.setTemperature');
            if (!isLocalLight(light))
                throw new HelixArgumentError('helix.light.setTemperature', 'só luzes locais têm temperatura; para o sol ajuste `color`.');
            if (kelvin === null) {
                light.temperature = null;
                return;
            }
            const temperature = requireNumber(kelvin, 'helix.light.setTemperature', 'a temperatura em Kelvin');
            light.temperature = Math.min(MAX_LIGHT_TEMPERATURE, Math.max(MIN_LIGHT_TEMPERATURE, temperature));
        },
        setColor: (value: unknown, color: unknown) => {
            const { light } = resolve(value, 'helix.light.setColor');
            if (light.type === 'ambient')
                toLinearColor(color, 'helix.light.setColor', light.skyColor);
            else
                toLinearColor(color, 'helix.light.setColor', light.color);
            if (isLocalLight(light))
                light.temperature = null;
        },
        cssColor: (value: unknown) => lightCssColor(resolve(value, 'helix.light.cssColor').light),
        temperatureRange: Object.freeze({ min: MIN_LIGHT_TEMPERATURE, max: MAX_LIGHT_TEMPERATURE }),
    };
}
