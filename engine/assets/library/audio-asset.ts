import { analyzeAudioBuffer, type AudioAnalysis } from '@/engine/audio/analysis/audio-analysis';
import { computeWaveformPeaks, type WaveformPeaks } from '@/engine/audio/analysis/waveform-peaks';
import { createClipSettings, sanitizeClipSettings, type AudioClipSettings } from '@/engine/audio/clip/audio-clip-settings';
import { decodeAudioFile } from '@/engine/audio/decode/audio-decoder';
import type { AudioAssetDetails, LibraryAsset } from './asset-types';
import { renderWaveformThumbnail } from './thumbnails/waveform-thumbnail';
const PROBE_TIMEOUT_MS = 4000;
export interface DecodedAudio {
    readonly buffer: AudioBuffer;
    readonly analysis: AudioAnalysis;
    readonly peaks: WaveformPeaks;
}
export async function decodeAndAnalyzeAudio(file: File): Promise<DecodedAudio> {
    const buffer = await decodeAudioFile(file);
    return { buffer, analysis: analyzeAudioBuffer(buffer), peaks: computeWaveformPeaks(buffer) };
}
export function probeAudioDuration(file: File): Promise<number | null> {
    if (typeof Audio === 'undefined')
        return Promise.resolve(null);
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        let settled = false;
        const finish = (value: number | null) => {
            if (settled)
                return;
            settled = true;
            URL.revokeObjectURL(url);
            audio.removeAttribute('src');
            resolve(value);
        };
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null);
        audio.onerror = () => finish(null);
        setTimeout(() => finish(null), PROBE_TIMEOUT_MS);
        audio.src = url;
    });
}
export function audioAssetDetails(analysis: AudioAnalysis | null, durationSeconds: number | null, clip: AudioClipSettings = createClipSettings()): AudioAssetDetails {
    return { kind: 'audio', durationSeconds: analysis?.durationSeconds ?? durationSeconds, analysis, clip };
}
export function upgradeAudioDetails(details: Partial<AudioAssetDetails> & {
    kind: 'audio';
}): AudioAssetDetails {
    return {
        kind: 'audio',
        durationSeconds: typeof details.durationSeconds === 'number' ? details.durationSeconds : null,
        analysis: details.analysis ?? null,
        clip: sanitizeClipSettings(details.clip),
    };
}
export type AudioLibraryAsset = LibraryAsset & {
    readonly details: AudioAssetDetails;
};
export function isAudioAsset(asset: LibraryAsset): asset is AudioLibraryAsset {
    return asset.kind === 'audio' && asset.details.kind === 'audio';
}
export async function renderAudioThumbnail(decoded: DecodedAudio): Promise<Blob | null> {
    return renderWaveformThumbnail(decoded.peaks);
}
