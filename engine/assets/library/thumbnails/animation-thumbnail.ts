import type { AnimationDocument, AnimationTrack } from '@/engine/core/animation/animation-document';
import { sampleTrack, trackComponents } from '@/engine/core/animation/track-sampling';
import { encodeCanvasToBlob, THUMBNAIL_SIZE } from './image-thumbnail';
const BACKGROUND = '#17191d';
const GRID = 'rgba(255, 255, 255, 0.06)';
const BASELINE = 'rgba(255, 255, 255, 0.14)';
const COMPONENT_COLORS = ['#ef5b6b', '#8ccf5f', '#4f9cf5', '#e0c05a'];
const MAX_TRACKS = 3;
const SAMPLES = 96;
function pickTracks(document: AnimationDocument): AnimationTrack[] {
    const weight = (track: AnimationTrack) => (track.path === 'rotation' ? 2 : track.path === 'translation' ? 1 : 0) * 1000000 + track.times.length;
    return [...document.tracks].sort((a, b) => weight(b) - weight(a)).slice(0, MAX_TRACKS);
}
function drawTrack(context: CanvasRenderingContext2D, track: AnimationTrack, duration: number, top: number, height: number, width: number): void {
    const components = trackComponents(track);
    const samples: Float32Array[] = [];
    const out = new Float32Array(4);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < SAMPLES; i++) {
        sampleTrack(track, (i / (SAMPLES - 1)) * duration, out);
        const sample = out.slice(0, components);
        samples.push(sample);
        for (const value of sample) {
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }
    const range = max - min < 1e-6 ? 1 : max - min;
    const pad = height * 0.12;
    for (let component = 0; component < components; component++) {
        context.beginPath();
        context.strokeStyle = COMPONENT_COLORS[component];
        context.lineWidth = 2;
        for (let i = 0; i < SAMPLES; i++) {
            const x = (i / (SAMPLES - 1)) * width;
            const y = top + pad + (1 - (samples[i][component] - min) / range) * (height - pad * 2);
            if (i === 0)
                context.moveTo(x, y);
            else
                context.lineTo(x, y);
        }
        context.stroke();
    }
}
export async function renderAnimationThumbnail(document: AnimationDocument, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    if (typeof window === 'undefined')
        return null;
    const tracks = pickTracks(document);
    const canvas = window.document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context)
        return null;
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
    if (tracks.length === 0) {
        context.strokeStyle = BASELINE;
        context.beginPath();
        context.moveTo(0, size / 2 + 0.5);
        context.lineTo(size, size / 2 + 0.5);
        context.stroke();
        return encodeCanvasToBlob(canvas);
    }
    const duration = Math.max(document.duration, 1e-3);
    const laneHeight = size / tracks.length;
    tracks.forEach((track, index) => {
        const top = index * laneHeight;
        if (index > 0) {
            context.strokeStyle = BASELINE;
            context.beginPath();
            context.moveTo(0, Math.round(top) + 0.5);
            context.lineTo(size, Math.round(top) + 0.5);
            context.stroke();
        }
        drawTrack(context, track, duration, top, laneHeight, size);
    });
    return encodeCanvasToBlob(canvas);
}
