import type { LibraryAsset, VideoAssetDetails } from './asset-types';
import { createThumbnailCanvas, encodeCanvasToBlob, THUMBNAIL_SIZE } from './thumbnails/image-thumbnail';
const PROBE_TIMEOUT_MS = 8000;
const THUMBNAIL_POSITION = 0.12;
export function isVideoAsset(asset: LibraryAsset): asset is LibraryAsset & {
    details: VideoAssetDetails;
} {
    return asset.kind === 'video' && asset.details.kind === 'video';
}
export interface ProbedVideo {
    readonly details: VideoAssetDetails;
    readonly thumbnail: Blob | null;
    readonly warning: string | null;
}
type AudioProbe = HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: {
        length: number;
    };
};
function detectAudio(video: AudioProbe): boolean | null {
    if (typeof video.mozHasAudio === 'boolean')
        return video.mozHasAudio;
    if (video.audioTracks)
        return video.audioTracks.length > 0;
    if (typeof video.webkitAudioDecodedByteCount === 'number')
        return video.webkitAudioDecodedByteCount > 0;
    return null;
}
function waitEvent(target: EventTarget, resolveOn: string, rejectOn: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error('O navegador demorou demais para abrir o vídeo.'));
        }, timeoutMs);
        const onResolve = () => {
            cleanup();
            resolve();
        };
        const onReject = () => {
            cleanup();
            reject(new Error('O navegador não conseguiu decodificar este vídeo (codec sem suporte?).'));
        };
        const cleanup = () => {
            window.clearTimeout(timer);
            target.removeEventListener(resolveOn, onResolve);
            target.removeEventListener(rejectOn, onReject);
        };
        target.addEventListener(resolveOn, onResolve, { once: true });
        target.addEventListener(rejectOn, onReject, { once: true });
    });
}
async function captureThumbnail(video: HTMLVideoElement, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    if (video.videoWidth === 0 || video.videoHeight === 0)
        return null;
    const target = createThumbnailCanvas(size);
    if (!target)
        return null;
    const { canvas, context } = target;
    const side = Math.min(video.videoWidth, video.videoHeight);
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
    try {
        return await encodeCanvasToBlob(canvas);
    }
    catch {
        return null;
    }
}
export async function probeVideo(file: File): Promise<ProbedVideo> {
    if (typeof document === 'undefined') {
        return { details: { kind: 'video', width: 0, height: 0, durationSeconds: null, hasAudio: null }, thumbnail: null, warning: null };
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video') as AudioProbe;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    try {
        await waitEvent(video, 'loadedmetadata', 'error', PROBE_TIMEOUT_MS);
        const durationSeconds = Number.isFinite(video.duration) ? video.duration : null;
        let thumbnail: Blob | null = null;
        try {
            if (durationSeconds !== null && durationSeconds > 0) {
                video.currentTime = Math.min(durationSeconds * THUMBNAIL_POSITION, Math.max(0, durationSeconds - 0.1));
                await waitEvent(video, 'seeked', 'error', PROBE_TIMEOUT_MS);
            }
            else {
                await waitEvent(video, 'loadeddata', 'error', PROBE_TIMEOUT_MS);
            }
            thumbnail = await captureThumbnail(video);
        }
        catch {
            thumbnail = null;
        }
        return {
            details: { kind: 'video', width: video.videoWidth, height: video.videoHeight, durationSeconds, hasAudio: detectAudio(video) },
            thumbnail,
            warning: null,
        };
    }
    catch (cause) {
        return {
            details: { kind: 'video', width: 0, height: 0, durationSeconds: null, hasAudio: null },
            thumbnail: null,
            warning: cause instanceof Error ? cause.message : 'O navegador não conseguiu abrir este vídeo.',
        };
    }
    finally {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
    }
}
export function videoAspectRatio(details: VideoAssetDetails): number {
    return details.width > 0 && details.height > 0 ? details.width / details.height : 16 / 9;
}
