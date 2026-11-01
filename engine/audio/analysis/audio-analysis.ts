import { dbToGain, gainToDb } from '@/engine/audio/core/decibels';
export const SILENCE_THRESHOLD_DB = -60;
export interface AudioAnalysis {
    readonly sampleRate: number;
    readonly channels: number;
    readonly durationSeconds: number;
    readonly peakDb: number;
    readonly rmsDb: number;
    readonly leadingSilence: number;
    readonly trailingSilence: number;
}
export function analyzeAudioBuffer(buffer: AudioBuffer): AudioAnalysis {
    const { length, numberOfChannels: channels, sampleRate } = buffer;
    const threshold = dbToGain(SILENCE_THRESHOLD_DB);
    let peak = 0;
    let sumSquares = 0;
    let firstLoud = length;
    let lastLoud = -1;
    for (let channel = 0; channel < channels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            const value = data[i];
            const magnitude = Math.abs(value);
            if (magnitude > peak)
                peak = magnitude;
            sumSquares += value * value;
            if (magnitude >= threshold) {
                if (i < firstLoud)
                    firstLoud = i;
                if (i > lastLoud)
                    lastLoud = i;
            }
        }
    }
    const samples = Math.max(1, length * channels);
    const silent = lastLoud < 0;
    return {
        sampleRate,
        channels,
        durationSeconds: buffer.duration,
        peakDb: gainToDb(peak),
        rmsDb: gainToDb(Math.sqrt(sumSquares / samples)),
        leadingSilence: silent ? buffer.duration : firstLoud / sampleRate,
        trailingSilence: silent ? 0 : (length - 1 - lastLoud) / sampleRate,
    };
}
export function normalizationGainDb(analysis: AudioAnalysis, targetPeakDb: number, maxGainDb: number): number {
    if (!Number.isFinite(analysis.peakDb))
        return 0;
    return Math.min(maxGainDb, targetPeakDb - analysis.peakDb);
}
export function describeChannels(channels: number): string {
    if (channels === 1)
        return 'mono';
    if (channels === 2)
        return 'estéreo';
    return `${channels} canais`;
}
export function formatSampleRate(sampleRate: number): string {
    return `${(sampleRate / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kHz`;
}
