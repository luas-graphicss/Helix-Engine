import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { decodeAndAnalyzeAudio, isAudioAsset } from '@/engine/assets/library/audio-asset';
import { renderWaveformThumbnail } from '@/engine/assets/library/thumbnails/waveform-thumbnail';
import { analyzeAudioBuffer, normalizationGainDb } from '@/engine/audio/analysis/audio-analysis';
import { computeWaveformPeaks, type WaveformPeaks } from '@/engine/audio/analysis/waveform-peaks';
import { findClipPreset } from '@/engine/audio/clip/audio-clip-presets';
import { CLIP_VOLUME_MAX_DB, CLIP_VOLUME_MIN_DB, createClipSettings, type AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { EFFECT_LABELS, type AudioEffectKey, type AudioEffectsSettings } from '@/engine/audio/clip/audio-effects';
import { AUDIO_EXTENSIONS } from '@/engine/audio/core/audio-formats';
import { clamp, formatDb } from '@/engine/audio/core/decibels';
import { renderClip } from '@/engine/audio/export/render-clip';
import { encodeWav, type WavBitDepth } from '@/engine/audio/export/wav-encoder';
import { AUDIO_BUSES, busInfo, type AudioBusId, type BusSettings } from '@/engine/audio/mixer/mixer-settings';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { downloadBlob } from '@/engine/editor/files/file-download';
import { pickFiles } from '@/engine/editor/files/file-picker';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addFilesToLibrary } from './asset-library-operations';
const LOG_SOURCE = 'Áudio';
const TRIM_PADDING_SECONDS = 0.005;
export const NORMALIZE_TARGET_DB = -1;
export const AUDIO_ACCEPT = [...AUDIO_EXTENSIONS.map((extension) => `.${extension}`), 'audio/*'].join(',');
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function loadAudioBuffer(session: EditorSession, asset: LibraryAsset): Promise<AudioBuffer> {
    return session.audio.engine.load(asset.id, () => session.library.primaryFile(asset));
}
async function completeAudioAnalysis(session: EditorSession, assetId: string, decoded: {
    buffer: AudioBuffer;
    peaks: WaveformPeaks;
}): Promise<void> {
    const asset = session.library.get(assetId);
    if (!asset || !isAudioAsset(asset))
        return;
    if (asset.details.analysis === null) {
        const analysis = analyzeAudioBuffer(decoded.buffer);
        session.library.setDetails(asset, { ...asset.details, durationSeconds: analysis.durationSeconds, analysis });
    }
    if (!asset.thumbnail) {
        const blob = await renderWaveformThumbnail(decoded.peaks);
        if (blob && session.library.get(assetId) === asset)
            session.library.setThumbnail(asset, { blob, custom: false });
    }
}
export async function openAudioAssetInEditor(session: EditorSession, asset: LibraryAsset, options: {
    play?: boolean;
} = {}): Promise<boolean> {
    if (!isAudioAsset(asset))
        return false;
    session.audio.stopQuickPreview();
    session.library.setBusy(`Abrindo ${asset.name}…`);
    try {
        const decoded = await session.audio.open(asset);
        if (!decoded) {
            if (session.audio.error)
                session.log.error(LOG_SOURCE, `Não foi possível abrir ${asset.name}: ${session.audio.error}`);
            return false;
        }
        await completeAudioAnalysis(session, asset.id, decoded);
        if (options.play ?? true)
            await session.audio.play();
        return true;
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function toggleQuickAudioPreview(session: EditorSession, asset: LibraryAsset): Promise<void> {
    try {
        await session.audio.toggleQuickPreview(asset);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível reproduzir ${asset.name}: ${describeError(cause)}`);
    }
}
export function updateAudioClip(session: EditorSession, asset: LibraryAsset, update: (clip: AudioClipSettings) => AudioClipSettings, label: string, mergeKey?: string): void {
    if (!isAudioAsset(asset))
        return;
    const before = asset.details.clip;
    const after = update(before);
    if (after === before)
        return;
    const apply = (clip: AudioClipSettings) => {
        const current = session.library.get(asset.id);
        if (current && isAudioAsset(current))
            session.library.setDetails(current, { ...current.details, clip });
    };
    session.history.execute(new SetValueCommand(label, apply, before, after, mergeKey));
}
export function patchAudioClip(session: EditorSession, asset: LibraryAsset, patch: Partial<AudioClipSettings>, label: string, mergeKey?: string): void {
    updateAudioClip(session, asset, (clip) => ({ ...clip, ...patch }), label, mergeKey);
}
export function patchAudioEffect<K extends AudioEffectKey>(session: EditorSession, asset: LibraryAsset, effect: K, patch: Partial<AudioEffectsSettings[K]>, label: string, mergeKey?: string): void {
    updateAudioClip(session, asset, (clip) => ({ ...clip, effects: { ...clip.effects, [effect]: { ...clip.effects[effect], ...patch } } }), label, mergeKey);
}
export function toggleAudioEffect(session: EditorSession, asset: LibraryAsset, effect: AudioEffectKey): void {
    if (!isAudioAsset(asset))
        return;
    const enabled = !asset.details.clip.effects[effect].enabled;
    patchAudioEffect(session, asset, effect, { enabled } as Partial<AudioEffectsSettings[typeof effect]>, `${enabled ? 'Ligar' : 'Desligar'} ${EFFECT_LABELS[effect].toLowerCase()} de ${asset.name}`);
}
export function applyAudioPreset(session: EditorSession, asset: LibraryAsset, presetId: string): void {
    const preset = findClipPreset(presetId);
    if (!preset || !isAudioAsset(asset))
        return;
    updateAudioClip(session, asset, (clip) => preset.apply(clip), `Preset ${preset.label} em ${asset.name}`);
    session.log.info(LOG_SOURCE, `${asset.name}: preset ${preset.label} aplicado (${preset.description.replace(/\.$/, '').toLowerCase()}).`);
}
export function resetAudioClip(session: EditorSession, asset: LibraryAsset): void {
    if (!isAudioAsset(asset))
        return;
    updateAudioClip(session, asset, (clip) => ({ ...createClipSettings(), bus: clip.bus }), `Restaurar o clipe de ${asset.name}`);
}
export function normalizeAudioClip(session: EditorSession, asset: LibraryAsset, targetPeakDb = NORMALIZE_TARGET_DB): void {
    if (!isAudioAsset(asset))
        return;
    const { analysis } = asset.details;
    if (!analysis) {
        session.log.warn(LOG_SOURCE, `${asset.name} ainda não foi analisado; abra-o no editor de áudio para medir o pico.`);
        return;
    }
    const volumeDb = clamp(normalizationGainDb(analysis, targetPeakDb, CLIP_VOLUME_MAX_DB), CLIP_VOLUME_MIN_DB, CLIP_VOLUME_MAX_DB);
    patchAudioClip(session, asset, { volumeDb }, `Normalizar ${asset.name}`);
    session.log.info(LOG_SOURCE, `${asset.name}: volume em ${formatDb(volumeDb)} para o pico ficar em ${formatDb(targetPeakDb, 0)}.`);
}
export function trimSilenceAudioClip(session: EditorSession, asset: LibraryAsset): void {
    if (!isAudioAsset(asset))
        return;
    const { analysis } = asset.details;
    if (!analysis) {
        session.log.warn(LOG_SOURCE, `${asset.name} ainda não foi analisado; abra-o no editor de áudio para detectar os silêncios.`);
        return;
    }
    const duration = analysis.durationSeconds;
    const trimStart = Math.max(0, analysis.leadingSilence - TRIM_PADDING_SECONDS);
    const end = Math.min(duration, duration - analysis.trailingSilence + TRIM_PADDING_SECONDS);
    const trimEnd = end >= duration - 1e-3 ? null : end;
    if (trimStart < 1e-3 && trimEnd === null) {
        session.log.info(LOG_SOURCE, `${asset.name} não tem silêncio nas pontas para recortar.`);
        return;
    }
    const removed = trimStart + (duration - (trimEnd ?? duration));
    patchAudioClip(session, asset, { trimStart, trimEnd, loopStart: null, loopEnd: null }, `Recortar silêncio de ${asset.name}`);
    session.log.info(LOG_SOURCE, `${asset.name}: ${removed.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s de silêncio fora do recorte.`);
}
async function renderAssetClip(session: EditorSession, asset: LibraryAsset): Promise<AudioBuffer | null> {
    if (!isAudioAsset(asset))
        return null;
    const buffer = await loadAudioBuffer(session, asset);
    return renderClip(buffer, asset.details.clip);
}
export async function exportProcessedAudio(session: EditorSession, asset: LibraryAsset, bitDepth: WavBitDepth = 16): Promise<void> {
    session.library.setBusy(`Renderizando ${asset.name}…`);
    try {
        const rendered = await renderAssetClip(session, asset);
        if (!rendered)
            return;
        const saved = await downloadBlob(encodeWav(rendered, bitDepth), `${asset.name}.wav`, 'Áudio WAV');
        if (saved)
            session.log.info(LOG_SOURCE, `${asset.name} exportado em WAV ${bitDepth} bits (${rendered.duration.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s).`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível exportar ${asset.name}: ${describeError(cause)}`);
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function bakeProcessedAudioToLibrary(session: EditorSession, asset: LibraryAsset): Promise<void> {
    session.library.setBusy(`Renderizando ${asset.name}…`);
    try {
        const rendered = await renderAssetClip(session, asset);
        if (!rendered)
            return;
        const file = new File([encodeWav(rendered, 24)], `${asset.name} (processado).wav`, { type: 'audio/wav' });
        const added = await addFilesToLibrary(session, [file]);
        const created = added.find(isAudioAsset);
        if (created)
            await openAudioAssetInEditor(session, created, { play: false });
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível consolidar ${asset.name}: ${describeError(cause)}`);
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function reanalyzeAudioAsset(session: EditorSession, asset: LibraryAsset): Promise<void> {
    if (!isAudioAsset(asset))
        return;
    session.library.setBusy(`Analisando ${asset.name}…`);
    try {
        const decoded = await decodeAndAnalyzeAudio(await session.library.primaryFile(asset));
        const current = session.library.get(asset.id);
        if (!current || !isAudioAsset(current))
            return;
        session.library.setDetails(current, { ...current.details, durationSeconds: decoded.analysis.durationSeconds, analysis: decoded.analysis });
        if (!current.thumbnail?.custom) {
            const blob = await renderWaveformThumbnail(decoded.peaks);
            if (blob)
                session.library.setThumbnail(current, { blob, custom: false });
        }
        session.log.info(LOG_SOURCE, `${asset.name} analisado: pico ${formatDb(decoded.analysis.peakDb)}, RMS ${formatDb(decoded.analysis.rmsDb)}.`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível analisar ${asset.name}: ${describeError(cause)}`);
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function renderAudioAssetThumbnail(session: EditorSession, asset: LibraryAsset): Promise<Blob | null> {
    const buffer = await loadAudioBuffer(session, asset);
    return renderWaveformThumbnail(computeWaveformPeaks(buffer));
}
export function pickAudioFilesForLibrary(session: EditorSession): void {
    void pickFiles({ accept: AUDIO_ACCEPT, multiple: true })
        .then((files) => addFilesToLibrary(session, files))
        .then((added) => {
        const first = added.find(isAudioAsset);
        if (first)
            return openAudioAssetInEditor(session, first, { play: false });
    });
}
function applyBusSetting<K extends keyof BusSettings>(session: EditorSession, bus: AudioBusId, key: K, value: BusSettings[K]): void {
    session.scene.audio.buses[bus][key] = value;
    session.audio.applyMixer();
}
export function setBusVolume(session: EditorSession, bus: AudioBusId, volumeDb: number): void {
    const current = session.scene.audio.buses[bus];
    if (!Number.isFinite(volumeDb) || volumeDb === current.volumeDb)
        return;
    session.history.execute(new SetValueCommand(`Volume de ${busInfo(bus).label}`, (value) => applyBusSetting(session, bus, 'volumeDb', value), current.volumeDb, volumeDb, `mixer:${bus}:volume`));
}
export function toggleBusMute(session: EditorSession, bus: AudioBusId): void {
    const current = session.scene.audio.buses[bus];
    session.history.execute(new SetValueCommand(`${current.muted ? 'Ativar' : 'Silenciar'} ${busInfo(bus).label}`, (value) => applyBusSetting(session, bus, 'muted', value), current.muted, !current.muted));
}
export function toggleBusSolo(session: EditorSession, bus: AudioBusId): void {
    if (bus === 'master')
        return;
    const current = session.scene.audio.buses[bus];
    session.history.execute(new SetValueCommand(`Solo de ${busInfo(bus).label}`, (value) => applyBusSetting(session, bus, 'solo', value), current.solo, !current.solo));
}
export function resetMixer(session: EditorSession): void {
    type Snapshot = Record<AudioBusId, BusSettings>;
    const snapshot = (): Snapshot => {
        const result = {} as Snapshot;
        for (const info of AUDIO_BUSES)
            result[info.id] = { ...session.scene.audio.buses[info.id] };
        return result;
    };
    const before = snapshot();
    const after = {} as Snapshot;
    for (const info of AUDIO_BUSES)
        after[info.id] = { volumeDb: 0, muted: false, solo: false };
    const apply = (value: Snapshot) => {
        for (const info of AUDIO_BUSES)
            Object.assign(session.scene.audio.buses[info.id], value[info.id]);
        session.audio.applyMixer();
    };
    session.history.execute(new SetValueCommand('Restaurar a mesa de som', apply, before, after));
}
