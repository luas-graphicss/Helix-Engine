import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { isAudioAsset } from '@/engine/assets/library/audio-asset';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { clamp } from '@/engine/audio/core/decibels';
import { encodeWav } from '@/engine/audio/export/wav-encoder';
import { findTestSignal, renderTestSignal, type TestSignalKind } from '@/engine/audio/synth/test-signals';
import { AUDIO_SOURCE_TRIGGER_LABEL, createAudioSourceSettings, findAudioSourcePreset, SOURCE_AIR_ABSORPTION_MAX, SOURCE_DOPPLER_MAX, SOURCE_FADE_MAX_SECONDS, SOURCE_MAX_DISTANCE_MAX, SOURCE_MIN_DISTANCE_MIN, SOURCE_PITCH_RANGE, SOURCE_PRIORITY_MAX, SOURCE_REPEAT_MAX_SECONDS, SOURCE_ROLLOFF_MAX, SOURCE_VOLUME_MAX_DB, SOURCE_VOLUME_MIN_DB, type AudioSourceCone, type AudioSourceOcclusion, type AudioSourceSettings, } from '@/engine/audio/world/audio-source-settings';
import { createAudioZoneSettings, findAudioZonePreset, ZONE_AMBIENCE_MAX_DB, ZONE_AMBIENCE_MIN_DB, ZONE_FALLOFF_MAX, ZONE_PRIORITY_MAX, ZONE_SIZE_MAX, ZONE_SIZE_MIN, type AudioZoneAmbience, type AudioZoneFilter, type AudioZoneSettings, } from '@/engine/audio/world/audio-zone-settings';
import type { DelaySettings, ReverbSettings } from '@/engine/audio/clip/audio-effects';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addFilesToLibrary } from './asset-library-operations';
import { addEntity, spawnPosition } from './entity-operations';
const LOG_SOURCE = 'Áudio 3D';
const SOURCE_NAME = 'FonteDeSom';
const ZONE_NAME = 'ZonaAcustica';
const SOURCE_SPAWN_HEIGHT = 1;
export type AudioSourceScalarField = 'volumeDb' | 'pitch' | 'triggerRadius' | 'fadeIn' | 'fadeOut' | 'repeatMin' | 'repeatMax' | 'minDistance' | 'maxDistance' | 'rolloff' | 'airAbsorption' | 'doppler' | 'reverbSend' | 'priority';
interface Limits {
    readonly min: number;
    readonly max: number;
    readonly label: string;
}
const SOURCE_SCALAR_LIMITS: Record<AudioSourceScalarField, Limits> = {
    volumeDb: { min: SOURCE_VOLUME_MIN_DB, max: SOURCE_VOLUME_MAX_DB, label: 'Volume da fonte' },
    pitch: { min: -SOURCE_PITCH_RANGE, max: SOURCE_PITCH_RANGE, label: 'Tom da fonte' },
    triggerRadius: { min: 0, max: SOURCE_MAX_DISTANCE_MAX, label: 'Raio do gatilho' },
    fadeIn: { min: 0, max: SOURCE_FADE_MAX_SECONDS, label: 'Rampa de entrada' },
    fadeOut: { min: 0, max: SOURCE_FADE_MAX_SECONDS, label: 'Rampa de saída' },
    repeatMin: { min: 0, max: SOURCE_REPEAT_MAX_SECONDS, label: 'Espera mínima da repetição' },
    repeatMax: { min: 0, max: SOURCE_REPEAT_MAX_SECONDS, label: 'Espera máxima da repetição' },
    minDistance: { min: SOURCE_MIN_DISTANCE_MIN, max: SOURCE_MAX_DISTANCE_MAX, label: 'Distância mínima' },
    maxDistance: { min: SOURCE_MIN_DISTANCE_MIN, max: SOURCE_MAX_DISTANCE_MAX, label: 'Alcance máximo' },
    rolloff: { min: 0, max: SOURCE_ROLLOFF_MAX, label: 'Queda com a distância' },
    airAbsorption: { min: 0, max: SOURCE_AIR_ABSORPTION_MAX, label: 'Absorção do ar' },
    doppler: { min: 0, max: SOURCE_DOPPLER_MAX, label: 'Efeito Doppler' },
    reverbSend: { min: 0, max: 1, label: 'Envio à reverberação' },
    priority: { min: 0, max: SOURCE_PRIORITY_MAX, label: 'Prioridade da fonte' },
};
export type AudioZoneScalarField = 'radius' | 'falloff' | 'priority';
const ZONE_SCALAR_LIMITS: Record<AudioZoneScalarField, Limits> = {
    radius: { min: ZONE_SIZE_MIN * 0.5, max: ZONE_SIZE_MAX * 0.5, label: 'Raio da zona' },
    falloff: { min: 0, max: ZONE_FALLOFF_MAX, label: 'Transição da zona' },
    priority: { min: 0, max: ZONE_PRIORITY_MAX, label: 'Prioridade da zona' },
};
export function defaultSourceAssetId(session: EditorSession): string | null {
    return session.audio.assetId ?? session.library.byKind('audio')[0]?.id ?? null;
}
function audioAssetName(session: EditorSession, assetId: string | null): string | null {
    if (!assetId)
        return null;
    const asset = session.library.get(assetId);
    return asset && isAudioAsset(asset) ? asset.name : null;
}
export interface AddSoundSourceOptions {
    assetId?: string | null;
    presetId?: string;
    position?: Vec3;
    name?: string;
}
export function addSoundSource(session: EditorSession, options: AddSoundSourceOptions = {}): Entity {
    const assetId = options.assetId === undefined ? defaultSourceAssetId(session) : options.assetId;
    const preset = options.presetId ? findAudioSourcePreset(options.presetId) : null;
    const base = createAudioSourceSettings({ assetId });
    const settings = preset ? preset.apply(base) : base;
    const name = options.name ?? (preset ? preset.label.replace(/\s+/g, '') : audioAssetName(session, assetId)?.replace(/\.[^.]+$/, '') ?? SOURCE_NAME);
    const entity = session.scene.createEntity({ name, kind: 'sound', audioSource: settings }, null);
    if (options.position) {
        vec3.copy(entity.transform.position, options.position);
    }
    else {
        const position = spawnPosition(session, null);
        position[1] += SOURCE_SPAWN_HEIGHT;
        vec3.copy(entity.transform.position, position);
    }
    const added = addEntity(session, entity, undefined, `Adicionar fonte de som ${name}`);
    if (!assetId)
        session.log.warn(LOG_SOURCE, `${added.name} não tem áudio: escolha um na seção Fonte de som do inspetor (ou gere um som de teste).`);
    return added;
}
export interface AddAudioZoneOptions {
    presetId?: string;
    position?: Vec3;
    name?: string;
}
export function addAudioZone(session: EditorSession, options: AddAudioZoneOptions = {}): Entity {
    const preset = options.presetId ? findAudioZonePreset(options.presetId) : null;
    const settings = createAudioZoneSettings(preset ? preset.create() : {});
    const name = options.name ?? (preset ? `Zona${preset.label.replace(/[^\p{L}\p{N}]+/gu, '')}` : ZONE_NAME);
    const entity = session.scene.createEntity({ name, kind: 'sound', audioZone: settings }, null);
    if (options.position) {
        vec3.copy(entity.transform.position, options.position);
    }
    else {
        const position = spawnPosition(session, null);
        position[1] += settings.size[1] * 0.5;
        vec3.copy(entity.transform.position, position);
    }
    return addEntity(session, entity, undefined, `Adicionar zona acústica ${name}`);
}
export function placeAudioAssetAsSource(session: EditorSession, asset: LibraryAsset, position: Vec3 | null = null): Entity | null {
    if (!isAudioAsset(asset))
        return null;
    return addSoundSource(session, { assetId: asset.id, position: position ?? undefined });
}
export function canCarryAudio(entity: Entity): boolean {
    return entity.parent !== null && !entity.terrain && !entity.csgBrush;
}
export function attachAudioSource(session: EditorSession, entity: Entity, assetId: string | null = defaultSourceAssetId(session)): void {
    if (entity.audioSource || !canCarryAudio(entity))
        return;
    const settings = createAudioSourceSettings({ assetId });
    session.history.execute(new SetValueCommand<AudioSourceSettings | null>(`Anexar fonte de som a ${entity.name}`, (value) => {
        entity.audioSource = value;
    }, null, settings));
    session.log.info(LOG_SOURCE, `${entity.name} recebeu uma fonte de som${assetId ? ` (${audioAssetName(session, assetId)})` : ''}; ela acompanha o ator.`);
}
export function detachAudioSource(session: EditorSession, entity: Entity): void {
    const current = entity.audioSource;
    if (!current)
        return;
    session.audio.world.stop(entity.id);
    session.history.execute(new SetValueCommand<AudioSourceSettings | null>(`Remover fonte de som de ${entity.name}`, (value) => {
        entity.audioSource = value;
    }, current, null));
}
export function attachAudioZone(session: EditorSession, entity: Entity): void {
    if (entity.audioZone || !canCarryAudio(entity))
        return;
    session.history.execute(new SetValueCommand<AudioZoneSettings | null>(`Anexar zona acústica a ${entity.name}`, (value) => {
        entity.audioZone = value;
    }, null, createAudioZoneSettings()));
    session.log.info(LOG_SOURCE, `${entity.name} recebeu uma zona acústica: ajuste o volume dela na seção Zona acústica do inspetor.`);
}
export function detachAudioZone(session: EditorSession, entity: Entity): void {
    const current = entity.audioZone;
    if (!current)
        return;
    session.history.execute(new SetValueCommand<AudioZoneSettings | null>(`Remover zona acústica de ${entity.name}`, (value) => {
        entity.audioZone = value;
    }, current, null));
}
export function updateAudioSource(session: EditorSession, entity: Entity, update: (settings: AudioSourceSettings) => AudioSourceSettings, label: string, mergeKey?: string): void {
    const before = entity.audioSource;
    if (!before)
        return;
    const after = update(before);
    if (after === before)
        return;
    session.history.execute(new SetValueCommand(label, (value) => {
        entity.audioSource = value;
    }, before, after, mergeKey));
}
export function patchAudioSource(session: EditorSession, entity: Entity, patch: Partial<AudioSourceSettings>, label: string, mergeKey?: string): void {
    updateAudioSource(session, entity, (settings) => ({ ...settings, ...patch }), label, mergeKey);
}
export function setAudioSourceScalar(session: EditorSession, entity: Entity, field: AudioSourceScalarField, value: number): void {
    const settings = entity.audioSource;
    if (!settings || !Number.isFinite(value))
        return;
    const limits = SOURCE_SCALAR_LIMITS[field];
    const next = field === 'priority' ? Math.round(clamp(value, limits.min, limits.max)) : clamp(value, limits.min, limits.max);
    if (settings[field] === next)
        return;
    const patch: Partial<AudioSourceSettings> = { [field]: next };
    if (field === 'minDistance' && next > settings.maxDistance)
        patch.maxDistance = next;
    if (field === 'maxDistance' && next < settings.minDistance)
        patch.minDistance = next;
    if (field === 'repeatMin' && next > settings.repeatMax)
        patch.repeatMax = next;
    if (field === 'repeatMax' && next < settings.repeatMin)
        patch.repeatMin = next;
    patchAudioSource(session, entity, patch, limits.label, `audio-source:${entity.id}:${field}`);
}
export function setAudioSourceAsset(session: EditorSession, entity: Entity, assetId: string | null): void {
    const settings = entity.audioSource;
    if (!settings || settings.assetId === assetId)
        return;
    const name = audioAssetName(session, assetId);
    patchAudioSource(session, entity, { assetId }, assetId ? `Tocar ${name} em ${entity.name}` : `Fonte ${entity.name} sem áudio`);
}
export function setAudioSourceMuted(session: EditorSession, entity: Entity, muted: boolean): void {
    if (!entity.audioSource || entity.audioSource.muted === muted)
        return;
    patchAudioSource(session, entity, { muted }, muted ? `Silenciar ${entity.name}` : `Ativar o som de ${entity.name}`);
}
export function setAudioSourceCone(session: EditorSession, entity: Entity, patch: Partial<AudioSourceCone>, mergeKey?: string): void {
    updateAudioSource(session, entity, (settings) => {
        const outerAngle = clamp(patch.outerAngle ?? settings.cone.outerAngle, 1, 360);
        const innerAngle = clamp(patch.innerAngle ?? settings.cone.innerAngle, 0, outerAngle);
        const cone: AudioSourceCone = {
            enabled: patch.enabled ?? settings.cone.enabled,
            innerAngle,
            outerAngle,
            outerGainDb: clamp(patch.outerGainDb ?? settings.cone.outerGainDb, -60, 0),
        };
        const same = cone.enabled === settings.cone.enabled && cone.innerAngle === settings.cone.innerAngle && cone.outerAngle === settings.cone.outerAngle && cone.outerGainDb === settings.cone.outerGainDb;
        return same ? settings : { ...settings, cone };
    }, patch.enabled !== undefined ? (patch.enabled ? 'Ligar cone da fonte' : 'Desligar cone da fonte') : 'Cone da fonte', mergeKey);
}
export function setAudioSourceOcclusion(session: EditorSession, entity: Entity, patch: Partial<AudioSourceOcclusion>, mergeKey?: string): void {
    updateAudioSource(session, entity, (settings) => {
        const occlusion: AudioSourceOcclusion = {
            enabled: patch.enabled ?? settings.occlusion.enabled,
            attenuationDb: clamp(patch.attenuationDb ?? settings.occlusion.attenuationDb, -60, 0),
            lowpass: clamp(patch.lowpass ?? settings.occlusion.lowpass, 100, 20000),
        };
        const same = occlusion.enabled === settings.occlusion.enabled && occlusion.attenuationDb === settings.occlusion.attenuationDb && occlusion.lowpass === settings.occlusion.lowpass;
        return same ? settings : { ...settings, occlusion };
    }, patch.enabled !== undefined ? (patch.enabled ? 'Ligar oclusão da fonte' : 'Desligar oclusão da fonte') : 'Oclusão da fonte', mergeKey);
}
export function applyAudioSourcePreset(session: EditorSession, entity: Entity, presetId: string): void {
    const preset = findAudioSourcePreset(presetId);
    if (!preset || !entity.audioSource)
        return;
    updateAudioSource(session, entity, (settings) => preset.apply(settings), `Preset ${preset.label} em ${entity.name}`);
    session.log.info(LOG_SOURCE, `${entity.name}: preset "${preset.label}" (${AUDIO_SOURCE_TRIGGER_LABEL[entity.audioSource.trigger].toLowerCase()}).`);
}
export function updateAudioZone(session: EditorSession, entity: Entity, update: (settings: AudioZoneSettings) => AudioZoneSettings, label: string, mergeKey?: string): void {
    const before = entity.audioZone;
    if (!before)
        return;
    const after = update(before);
    if (after === before)
        return;
    session.history.execute(new SetValueCommand(label, (value) => {
        entity.audioZone = value;
    }, before, after, mergeKey));
}
export function patchAudioZone(session: EditorSession, entity: Entity, patch: Partial<Omit<AudioZoneSettings, 'size'>>, label: string, mergeKey?: string): void {
    updateAudioZone(session, entity, (settings) => ({ ...settings, ...patch }), label, mergeKey);
}
export function setAudioZoneScalar(session: EditorSession, entity: Entity, field: AudioZoneScalarField, value: number): void {
    const settings = entity.audioZone;
    if (!settings || !Number.isFinite(value))
        return;
    const limits = ZONE_SCALAR_LIMITS[field];
    const next = field === 'priority' ? Math.round(clamp(value, limits.min, limits.max)) : clamp(value, limits.min, limits.max);
    if (settings[field] === next)
        return;
    patchAudioZone(session, entity, { [field]: next }, limits.label, `audio-zone:${entity.id}:${field}`);
}
export function setAudioZoneSizeComponent(session: EditorSession, entity: Entity, axis: 0 | 1 | 2, value: number): void {
    const settings = entity.audioZone;
    if (!settings || !Number.isFinite(value))
        return;
    const next = clamp(value, ZONE_SIZE_MIN, ZONE_SIZE_MAX);
    if (settings.size[axis] === next)
        return;
    updateAudioZone(session, entity, (current) => {
        const size = vec3.copy(vec3.create(), current.size);
        size[axis] = next;
        return { ...current, size };
    }, `Tamanho da zona ${'XYZ'[axis]}`, `audio-zone:${entity.id}:size:${axis}`);
}
export function setAudioZoneReverb(session: EditorSession, entity: Entity, patch: Partial<ReverbSettings>, mergeKey?: string): void {
    updateAudioZone(session, entity, (settings) => ({ ...settings, reverb: { ...settings.reverb, ...patch } }), patch.enabled !== undefined ? (patch.enabled ? 'Ligar reverberação da zona' : 'Desligar reverberação da zona') : 'Reverberação da zona', mergeKey);
}
export function setAudioZoneEcho(session: EditorSession, entity: Entity, patch: Partial<DelaySettings>, mergeKey?: string): void {
    updateAudioZone(session, entity, (settings) => ({ ...settings, echo: { ...settings.echo, ...patch } }), patch.enabled !== undefined ? (patch.enabled ? 'Ligar eco da zona' : 'Desligar eco da zona') : 'Eco da zona', mergeKey);
}
export function setAudioZoneFilter(session: EditorSession, entity: Entity, patch: Partial<AudioZoneFilter>, mergeKey?: string): void {
    updateAudioZone(session, entity, (settings) => ({ ...settings, filter: { ...settings.filter, ...patch } }), patch.enabled !== undefined ? (patch.enabled ? 'Ligar filtro da zona' : 'Desligar filtro da zona') : 'Filtro da zona', mergeKey);
}
export function setAudioZoneAmbience(session: EditorSession, entity: Entity, patch: Partial<AudioZoneAmbience>, mergeKey?: string): void {
    updateAudioZone(session, entity, (settings) => {
        const ambience: AudioZoneAmbience = {
            assetId: patch.assetId !== undefined ? patch.assetId : settings.ambience.assetId,
            volumeDb: clamp(patch.volumeDb ?? settings.ambience.volumeDb, ZONE_AMBIENCE_MIN_DB, ZONE_AMBIENCE_MAX_DB),
        };
        return ambience.assetId === settings.ambience.assetId && ambience.volumeDb === settings.ambience.volumeDb ? settings : { ...settings, ambience };
    }, patch.assetId !== undefined ? (patch.assetId ? `Cama ambiente de ${entity.name}` : `Zona ${entity.name} sem cama ambiente`) : 'Volume da cama ambiente', mergeKey);
}
