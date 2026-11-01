import { createThumbnailCanvas, encodeCanvasToBlob, THUMBNAIL_SIZE } from './image-thumbnail';
const BACKDROP = '#141821';
const SAMPLE = 'Aa';
const SUBSAMPLE = 'Bb Cc 123';
export async function renderFontThumbnail(file: File, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    if (typeof window === 'undefined')
        return null;
    const family = `hx-font-preview-${Math.random().toString(36).slice(2)}`;
    const face = new FontFace(family, await file.arrayBuffer());
    try {
        await face.load();
    }
    catch {
        return null;
    }
    document.fonts.add(face);
    try {
        const target = createThumbnailCanvas(size);
        if (!target)
            return null;
        const { canvas, context } = target;
        context.fillStyle = BACKDROP;
        context.fillRect(0, 0, size, size);
        context.fillStyle = '#f4f6fb';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `${Math.round(size * 0.46)}px "${family}"`;
        context.fillText(SAMPLE, size / 2, size * 0.44);
        context.fillStyle = 'rgba(244, 246, 251, 0.55)';
        context.font = `${Math.round(size * 0.11)}px "${family}"`;
        context.fillText(SUBSAMPLE, size / 2, size * 0.8);
        return await encodeCanvasToBlob(canvas);
    }
    finally {
        document.fonts.delete(face);
    }
}
