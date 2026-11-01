export const PEAK_BUCKET_SAMPLES = 256;
export interface WaveformPeaks {
    readonly bucketSize: number;
    readonly sampleRate: number;
    readonly length: number;
    readonly min: Float32Array;
    readonly max: Float32Array;
}
export interface PeakColumns {
    min: Float32Array;
    max: Float32Array;
}
export function computeWaveformPeaks(buffer: AudioBuffer, bucketSize = PEAK_BUCKET_SAMPLES): WaveformPeaks {
    const length = buffer.length;
    const buckets = Math.max(1, Math.ceil(length / bucketSize));
    const min = new Float32Array(buckets).fill(0);
    const max = new Float32Array(buckets).fill(0);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let bucket = 0; bucket < buckets; bucket++) {
            const start = bucket * bucketSize;
            const end = Math.min(length, start + bucketSize);
            let lo = channel === 0 ? Number.POSITIVE_INFINITY : min[bucket];
            let hi = channel === 0 ? Number.NEGATIVE_INFINITY : max[bucket];
            for (let i = start; i < end; i++) {
                const value = data[i];
                if (value < lo)
                    lo = value;
                if (value > hi)
                    hi = value;
            }
            min[bucket] = lo;
            max[bucket] = hi;
        }
    }
    return { bucketSize, sampleRate: buffer.sampleRate, length, min, max };
}
export function createPeakColumns(columns: number): PeakColumns {
    return { min: new Float32Array(columns), max: new Float32Array(columns) };
}
export function samplePeakColumns(peaks: WaveformPeaks, buffer: AudioBuffer | null, startSeconds: number, endSeconds: number, out: PeakColumns): void {
    const columns = out.min.length;
    const startSample = startSeconds * peaks.sampleRate;
    const samplesPerColumn = ((endSeconds - startSeconds) * peaks.sampleRate) / columns;
    const fromSamples = buffer !== null && samplesPerColumn < peaks.bucketSize;
    const channels = buffer?.numberOfChannels ?? 0;
    for (let column = 0; column < columns; column++) {
        const a = startSample + column * samplesPerColumn;
        const b = a + samplesPerColumn;
        let lo = Number.POSITIVE_INFINITY;
        let hi = Number.NEGATIVE_INFINITY;
        if (fromSamples && buffer) {
            const first = Math.max(0, Math.floor(a));
            const last = Math.min(peaks.length - 1, Math.max(first, Math.ceil(b) - 1));
            for (let channel = 0; channel < channels; channel++) {
                const data = buffer.getChannelData(channel);
                for (let i = first; i <= last; i++) {
                    const value = data[i];
                    if (value < lo)
                        lo = value;
                    if (value > hi)
                        hi = value;
                }
            }
        }
        else {
            const first = Math.max(0, Math.floor(a / peaks.bucketSize));
            const last = Math.min(peaks.min.length - 1, Math.max(first, Math.ceil(b / peaks.bucketSize) - 1));
            for (let i = first; i <= last; i++) {
                if (peaks.min[i] < lo)
                    lo = peaks.min[i];
                if (peaks.max[i] > hi)
                    hi = peaks.max[i];
            }
        }
        if (lo === Number.POSITIVE_INFINITY) {
            lo = 0;
            hi = 0;
        }
        out.min[column] = lo;
        out.max[column] = hi;
    }
}
