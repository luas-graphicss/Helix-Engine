import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { VfxDocument } from '@/engine/vfx/document/vfx-document';
import { drawVfxPreview, previewCamera, simulateVfxPreview } from '@/engine/vfx/preview/vfx-canvas-preview';
import { createThumbnailCanvas, encodeCanvasToBlob, THUMBNAIL_SIZE } from './image-thumbnail';
const BACKDROP = '#141821';
const FLOOR = 'rgba(255, 255, 255, 0.06)';
export async function renderVfxThumbnail(document: VfxDocument, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    const target = createThumbnailCanvas(size);
    if (!target)
        return null;
    const { canvas, context } = target;
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, size, size);
    const instance = simulateVfxPreview(document);
    const camera = previewCamera(document, 1);
    const origin = mat4.transformPoint(vec3.create(), camera.viewProjection, vec3.create());
    const floorY = Math.round((0.5 - origin[1] * 0.5) * size) + 0.5;
    context.strokeStyle = FLOOR;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(size * 0.08, floorY);
    context.lineTo(size * 0.92, floorY);
    context.stroke();
    drawVfxPreview(context, instance, camera, 0, 0, size, size);
    return encodeCanvasToBlob(canvas);
}
