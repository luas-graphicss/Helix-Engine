import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { convertLocalLight, isLocalLight, LOCAL_LIGHT_LABEL, MAX_LIGHT_TEMPERATURE, MAX_SPOT_ANGLE, MIN_LIGHT_TEMPERATURE, temperatureToLinearRgb, type Light, type LightAnimation, type LocalLight, type LocalLightShadow, type LocalLightType, } from '@/engine/core/scene/light';
import { getLightPreset, type LightPresetId } from '@/engine/core/scene/light-presets';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Command } from '@/engine/editor/history/command';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
export type LightColorField = 'color' | 'skyColor' | 'groundColor';
export type LocalLightScalarField = 'intensity' | 'range' | 'falloff' | 'sourceRadius' | 'specular' | 'animationSpeed' | 'animationAmount';
export type LocalLightDimensionField = 'width' | 'height' | 'radius' | 'length';
export type LocalLightShadowField = Exclude<keyof LocalLightShadow, 'enabled'>;
export type LightColorMode = 'rgb' | 'kelvin';
interface Limits {
    readonly min: number;
    readonly max: number;
    readonly label: string;
}
const SCALAR_LIMITS: Record<LocalLightScalarField, Limits> = {
    intensity: { min: 0, max: 100000, label: 'Intensidade da luz' },
    range: { min: 0, max: 1000, label: 'Alcance da luz' },
    falloff: { min: 0.5, max: 6, label: 'Queda da luz' },
    sourceRadius: { min: 0, max: 10, label: 'Raio da fonte' },
    specular: { min: 0, max: 4, label: 'Especular da luz' },
    animationSpeed: { min: 0, max: 60, label: 'Velocidade da animação' },
    animationAmount: { min: 0, max: 1, label: 'Profundidade da animação' },
};
const SHADOW_LIMITS: Record<LocalLightShadowField, Limits> = {
    softness: { min: 0, max: 1, label: 'Suavidade da sombra' },
    bias: { min: 0, max: 1, label: 'Viés da sombra' },
    normalBias: { min: 0, max: 8, label: 'Viés normal da sombra' },
    strength: { min: 0, max: 1, label: 'Força da sombra' },
};
const DIMENSION_LABEL: Record<LocalLightDimensionField, string> = {
    width: 'Largura do painel',
    height: 'Altura do painel',
    radius: 'Raio do disco',
    length: 'Comprimento do tubo',
};
const MIN_DIMENSION = 0.01;
const MAX_DIMENSION = 100;
const KELVIN_SEARCH_STEP = 50;
const DEFAULT_TEMPERATURE = 4000;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
function localLightOf(entity: Entity): LocalLight | null {
    return isLocalLight(entity.light) ? entity.light : null;
}
function colorTarget(light: Light, field: LightColorField): Vec3 | null {
    if (field === 'color')
        return light.type === 'ambient' ? null : light.color;
    return light.type === 'ambient' ? light[field] : null;
}
function replaceLight(session: EditorSession, entity: Entity, label: string, next: Light): void {
    const previous = entity.light;
    if (!previous)
        return;
    session.history.execute(new SetValueCommand<Light>(label, (value) => {
        entity.light = value;
    }, previous, next));
}
function nearestTemperature(rgb: Vec3): number {
    const target = vec3.create();
    const peak = Math.max(rgb[0], rgb[1], rgb[2], 1e-4);
    vec3.scale(target, rgb, 1 / peak);
    const candidate = vec3.create();
    let best = DEFAULT_TEMPERATURE;
    let bestDistance = Infinity;
    for (let kelvin = MIN_LIGHT_TEMPERATURE; kelvin <= MAX_LIGHT_TEMPERATURE; kelvin += KELVIN_SEARCH_STEP) {
        temperatureToLinearRgb(candidate, kelvin);
        const distance = vec3.distance(candidate, target);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = kelvin;
        }
    }
    return best;
}
export function setLightIntensity(session: EditorSession, entity: Entity, value: number): void {
    const { light } = entity;
    if (!light || !Number.isFinite(value))
        return;
    const next = clamp(value, 0, SCALAR_LIMITS.intensity.max);
    if (light.intensity === next)
        return;
    session.history.execute(new SetValueCommand(SCALAR_LIMITS.intensity.label, (v) => {
        light.intensity = v;
    }, light.intensity, next, `light:${entity.id}:intensity`));
}
export function setLightColor(session: EditorSession, entity: Entity, field: LightColorField, linearRgb: Vec3): void {
    const { light } = entity;
    if (!light)
        return;
    const target = colorTarget(light, field);
    if (!target)
        return;
    const local = isLocalLight(light) ? light : null;
    const before = { color: vec3.copy(vec3.create(), target), temperature: local?.temperature ?? null };
    const after = { color: vec3.copy(vec3.create(), linearRgb), temperature: null };
    session.history.execute(new SetValueCommand('Cor da luz', (value) => {
        vec3.copy(target, value.color);
        if (local)
            local.temperature = value.temperature;
    }, before, after, `light:${entity.id}:${field}`));
}
export function lightCastsShadows(light: Light): boolean {
    if (light.type === 'ambient')
        return false;
    return light.type === 'directional' ? light.castShadows : light.shadow.enabled;
}
function shadowCommand(entity: Entity, enabled: boolean): Command | null {
    const { light } = entity;
    if (!light || light.type === 'ambient' || lightCastsShadows(light) === enabled)
        return null;
    return new SetValueCommand(enabled ? 'Ativar sombras da luz' : 'Desativar sombras da luz', (value) => {
        if (light.type === 'directional')
            light.castShadows = value;
        else
            light.shadow.enabled = value;
    }, !enabled, enabled);
}
export function setLightShadows(session: EditorSession, entity: Entity, enabled: boolean): void {
    const command = shadowCommand(entity, enabled);
    if (command)
        session.history.execute(command);
}
export function setLightsShadows(session: EditorSession, entities: readonly Entity[], enabled: boolean): void {
    const commands: Command[] = [];
    for (const entity of entities) {
        const command = shadowCommand(entity, enabled);
        if (command)
            commands.push(command);
    }
    if (commands.length === 0)
        return;
    const label = `${enabled ? 'Ativar' : 'Desativar'} sombras de ${commands.length} ${commands.length === 1 ? 'luz' : 'luzes'}`;
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(label, commands));
}
export function setLocalLightScalar(session: EditorSession, entity: Entity, field: LocalLightScalarField, value: number): void {
    const light = localLightOf(entity);
    if (!light || !Number.isFinite(value))
        return;
    const limits = SCALAR_LIMITS[field];
    const next = clamp(value, limits.min, limits.max);
    if (light[field] === next)
        return;
    session.history.execute(new SetValueCommand(limits.label, (v) => {
        light[field] = v;
    }, light[field], next, `light:${entity.id}:${field}`));
}
export function setLocalLightTemperature(session: EditorSession, entity: Entity, kelvin: number): void {
    const light = localLightOf(entity);
    if (!light || !Number.isFinite(kelvin))
        return;
    const next = Math.round(clamp(kelvin, MIN_LIGHT_TEMPERATURE, MAX_LIGHT_TEMPERATURE));
    if (light.temperature === next)
        return;
    session.history.execute(new SetValueCommand('Temperatura da luz', (value) => {
        light.temperature = value;
    }, light.temperature, next, `light:${entity.id}:temperature`));
}
export function setLocalLightColorMode(session: EditorSession, entity: Entity, mode: LightColorMode): void {
    const light = localLightOf(entity);
    if (!light)
        return;
    const currentMode: LightColorMode = light.temperature === null ? 'rgb' : 'kelvin';
    if (currentMode === mode)
        return;
    const before = { color: vec3.copy(vec3.create(), light.color), temperature: light.temperature };
    const after = mode === 'rgb'
        ? { color: temperatureToLinearRgb(vec3.create(), light.temperature ?? DEFAULT_TEMPERATURE), temperature: null }
        : { color: vec3.copy(vec3.create(), light.color), temperature: nearestTemperature(light.color) };
    session.history.execute(new SetValueCommand(mode === 'rgb' ? 'Cor da luz em RGB' : 'Cor da luz em kelvin', (value) => {
        vec3.copy(light.color, value.color);
        light.temperature = value.temperature;
    }, before, after));
}
export function setSpotAngles(session: EditorSession, entity: Entity, patch: {
    innerAngle?: number;
    outerAngle?: number;
}): void {
    const light = localLightOf(entity);
    if (light?.type !== 'spot')
        return;
    const outer = clamp(patch.outerAngle ?? light.outerAngle, 1, MAX_SPOT_ANGLE);
    const inner = clamp(patch.innerAngle ?? light.innerAngle, 0, outer);
    if (!Number.isFinite(outer) || !Number.isFinite(inner))
        return;
    if (outer === light.outerAngle && inner === light.innerAngle)
        return;
    session.history.execute(new SetValueCommand('Ângulos do cone', (value) => {
        light.innerAngle = value.inner;
        light.outerAngle = value.outer;
    }, { inner: light.innerAngle, outer: light.outerAngle }, { inner, outer }, `light:${entity.id}:angles`));
}
export function setLocalLightDimension(session: EditorSession, entity: Entity, field: LocalLightDimensionField, value: number): void {
    const light = localLightOf(entity);
    if (!light || !Number.isFinite(value))
        return;
    const next = clamp(value, MIN_DIMENSION, MAX_DIMENSION);
    const apply = (v: number): boolean => {
        if (light.type === 'rect' && (field === 'width' || field === 'height'))
            light[field] = v;
        else if (light.type === 'disc' && field === 'radius')
            light.radius = v;
        else if (light.type === 'tube' && field === 'length')
            light.length = v;
        else
            return false;
        return true;
    };
    const current = light.type === 'rect' && (field === 'width' || field === 'height')
        ? light[field]
        : light.type === 'disc' && field === 'radius'
            ? light.radius
            : light.type === 'tube' && field === 'length'
                ? light.length
                : null;
    if (current === null || current === next)
        return;
    session.history.execute(new SetValueCommand(DIMENSION_LABEL[field], (v) => {
        apply(v);
    }, current, next, `light:${entity.id}:${field}`));
}
export function setLocalLightTwoSided(session: EditorSession, entity: Entity, twoSided: boolean): void {
    const light = localLightOf(entity);
    if (!light || (light.type !== 'rect' && light.type !== 'disc') || light.twoSided === twoSided)
        return;
    session.history.execute(new SetValueCommand(twoSided ? 'Emitir dos dois lados' : 'Emitir só para a frente', (value) => {
        light.twoSided = value;
    }, light.twoSided, twoSided));
}
export function setLocalLightShadowScalar(session: EditorSession, entity: Entity, field: LocalLightShadowField, value: number): void {
    const light = localLightOf(entity);
    if (!light || !Number.isFinite(value))
        return;
    const limits = SHADOW_LIMITS[field];
    const next = clamp(value, limits.min, limits.max);
    const { shadow } = light;
    if (shadow[field] === next)
        return;
    session.history.execute(new SetValueCommand(limits.label, (v) => {
        shadow[field] = v;
    }, shadow[field], next, `light:${entity.id}:shadow:${field}`));
}
export function setLocalLightAnimation(session: EditorSession, entity: Entity, animation: LightAnimation): void {
    const light = localLightOf(entity);
    if (!light || light.animation === animation)
        return;
    session.history.execute(new SetValueCommand('Animação da luz', (value) => {
        light.animation = value;
    }, light.animation, animation));
}
export function setLocalLightType(session: EditorSession, entity: Entity, type: LocalLightType): void {
    const light = localLightOf(entity);
    if (!light || light.type === type)
        return;
    replaceLight(session, entity, `Converter em ${LOCAL_LIGHT_LABEL[type].toLowerCase()}`, convertLocalLight(light, type));
}
export function applyLightPreset(session: EditorSession, entity: Entity, presetId: LightPresetId): void {
    const light = localLightOf(entity);
    if (!light)
        return;
    const preset = getLightPreset(presetId);
    const next = preset.create();
    next.shadow = { ...light.shadow };
    replaceLight(session, entity, `Preset ${preset.label}`, next);
    session.log.info('Luzes', `${entity.name}: preset "${preset.label}" aplicado.`);
}
