import type { GuiDocument } from '@/engine/gui/document/gui-document';
import { guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { guiIcons } from '@/engine/gui/icons/gui-icon-catalog';
import { guiImages } from '@/engine/gui/images/gui-image-cache';
import { layoutGuiDocument } from '@/engine/gui/layout/gui-layout';
import { renderGuiLayout } from '@/engine/gui/render/gui-renderer';
import { guiTextMeasurer } from '@/engine/gui/text/gui-text-measure';
import { createThumbnailCanvas, encodeCanvasToBlob, THUMBNAIL_SIZE } from './image-thumbnail';
const BACKDROP = '#141821';
const FRAME = 'rgba(255, 255, 255, 0.08)';
export async function renderGuiThumbnail(document: GuiDocument, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    const target = createThumbnailCanvas(size);
    if (!target)
        return null;
    const { canvas, context } = target;
    const { x: width, y: height } = document.referenceSize;
    const scale = (size * 0.92) / Math.max(width, height);
    const offsetX = (size - width * scale) / 2;
    const offsetY = (size - height * scale) / 2;
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#0b0e15';
    context.fillRect(offsetX, offsetY, width * scale, height * scale);
    const layout = layoutGuiDocument(document, { x: width, y: height }, { measurer: guiTextMeasurer, cssFamily: (family) => guiFonts.cssFamily(family) });
    context.save();
    context.beginPath();
    context.rect(offsetX, offsetY, width * scale, height * scale);
    context.clip();
    renderGuiLayout(context, layout, { base: [scale, 0, 0, scale, offsetX, offsetY], images: guiImages, icons: guiIcons, fonts: guiFonts, state: null, placeholders: true });
    context.restore();
    context.strokeStyle = FRAME;
    context.lineWidth = 1;
    context.strokeRect(offsetX + 0.5, offsetY + 0.5, width * scale - 1, height * scale - 1);
    return encodeCanvasToBlob(canvas);
}
