import { createPeakColumns, samplePeakColumns, type WaveformPeaks } from '@/engine/audio/analysis/waveform-peaks';
import { createThumbnailCanvas, encodeCanvasToBlob, THUMBNAIL_SIZE } from './image-thumbnail';
const BACKGROUND = '#17191d';
const GRID = 'rgba(255, 255, 255, 0.06)';
const BASELINE = 'rgba(255, 255, 255, 0.18)';
const WAVE_FILL = 'rgba(232, 160, 60, 0.55)';
const WAVE_LINE = '#f0b45a';
export async function renderWaveformThumbnail(peaks: WaveformPeaks, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    const target = createThumbnailCanvas(size);
    if (!target)
        return null;
    const { canvas, context } = target;
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, size, size);
    context.strokeStyle = GRID;
    context.lineWidth = 1;
    const divisions = 8;
    for (let i = 1; i < divisions; i++) {
        const offset = Math.round((i / divisions) * size) + 0.5;
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset, size);
        context.stroke();
    }
    const middle = size / 2;
    const amplitude = size * 0.42;
    const columns = createPeakColumns(size);
    samplePeakColumns(peaks, null, 0, peaks.length / peaks.sampleRate, columns);
    context.fillStyle = WAVE_FILL;
    context.beginPath();
    for (let x = 0; x < size; x++)
        context.lineTo(x, middle - columns.max[x] * amplitude);
    for (let x = size - 1; x >= 0; x--)
        context.lineTo(x, middle - columns.min[x] * amplitude);
    context.closePath();
    context.fill();
    context.strokeStyle = WAVE_LINE;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < size; x++) {
        const top = middle - columns.max[x] * amplitude;
        const bottom = middle - columns.min[x] * amplitude;
        context.moveTo(x + 0.5, top);
        context.lineTo(x + 0.5, Math.max(bottom, top + 1));
    }
    context.stroke();
    context.strokeStyle = BASELINE;
    context.beginPath();
    context.moveTo(0, Math.round(middle) + 0.5);
    context.lineTo(size, Math.round(middle) + 0.5);
    context.stroke();
    return encodeCanvasToBlob(canvas);
}
