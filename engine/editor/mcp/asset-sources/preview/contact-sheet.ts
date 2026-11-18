import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
export interface SheetCell {
    readonly badge: string;
    readonly title: string;
    readonly caption: string;
    readonly image: ImageBitmap | null;
}
type SheetContext = OffscreenCanvasRenderingContext2D;
const MAX_COLUMNS = 4;
const IMAGE_SIZE = 200;
const CAPTION_HEIGHT = 40;
const GAP = 8;
const TEXT_INSET = 6;
const BADGE_SIZE = 24;
const TITLE_BASELINE = 16;
const CAPTION_BASELINE = 32;
const ELLIPSIS = '…';
const JPEG_QUALITY = 0.86;
const SHEET_BACKGROUND = '#14161a';
const CELL_BACKGROUND = '#23262d';
const TEXT_COLOR = '#f2f3f5';
const MUTED_COLOR = '#9aa0aa';
const TITLE_FONT = '600 13px system-ui, sans-serif';
const CAPTION_FONT = '11px system-ui, sans-serif';
const BADGE_FONT = '700 13px system-ui, sans-serif';
const EMPTY_IMAGE_NOTE = 'no preview';
function fitText(context: SheetContext, text: string, maxWidth: number): string {
    if (context.measureText(text).width <= maxWidth)
        return text;
    let fitted = text;
    while (fitted.length > 1 && context.measureText(`${fitted}${ELLIPSIS}`).width > maxWidth)
        fitted = fitted.slice(0, -1);
    return `${fitted}${ELLIPSIS}`;
}
function drawImage(context: SheetContext, image: ImageBitmap | null, x: number, y: number): void {
    context.fillStyle = CELL_BACKGROUND;
    context.fillRect(x, y, IMAGE_SIZE, IMAGE_SIZE);
    if (!image) {
        context.fillStyle = MUTED_COLOR;
        context.font = CAPTION_FONT;
        context.textAlign = 'center';
        context.fillText(EMPTY_IMAGE_NOTE, x + IMAGE_SIZE / 2, y + IMAGE_SIZE / 2);
        context.textAlign = 'left';
        return;
    }
    const scale = Math.min(IMAGE_SIZE / image.width, IMAGE_SIZE / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, x + (IMAGE_SIZE - width) / 2, y + (IMAGE_SIZE - height) / 2, width, height);
}
function drawBadge(context: SheetContext, badge: string, x: number, y: number): void {
    context.fillStyle = TEXT_COLOR;
    context.fillRect(x, y, BADGE_SIZE, BADGE_SIZE);
    context.fillStyle = SHEET_BACKGROUND;
    context.font = BADGE_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(badge, x + BADGE_SIZE / 2, y + BADGE_SIZE / 2);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
}
function drawCell(context: SheetContext, cell: SheetCell, x: number, y: number): void {
    drawImage(context, cell.image, x, y);
    drawBadge(context, cell.badge, x, y);
    const textWidth = IMAGE_SIZE - TEXT_INSET;
    context.fillStyle = TEXT_COLOR;
    context.font = TITLE_FONT;
    context.fillText(fitText(context, cell.title, textWidth), x, y + IMAGE_SIZE + TITLE_BASELINE);
    context.fillStyle = MUTED_COLOR;
    context.font = CAPTION_FONT;
    context.fillText(fitText(context, cell.caption, textWidth), x, y + IMAGE_SIZE + CAPTION_BASELINE);
}
export async function renderContactSheet(cells: readonly SheetCell[]): Promise<Blob> {
    const columns = Math.min(MAX_COLUMNS, Math.max(1, cells.length));
    const rows = Math.max(1, Math.ceil(cells.length / columns));
    const canvas = new OffscreenCanvas(GAP + columns * (IMAGE_SIZE + GAP), GAP + rows * (IMAGE_SIZE + CAPTION_HEIGHT + GAP));
    const context = canvas.getContext('2d');
    if (!context)
        throw new ToolFailure('The browser could not create a drawing surface for the previews. Call again with previews set to false.');
    context.fillStyle = SHEET_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
    cells.forEach((cell, index) => {
        const x = GAP + (index % columns) * (IMAGE_SIZE + GAP);
        const y = GAP + Math.floor(index / columns) * (IMAGE_SIZE + CAPTION_HEIGHT + GAP);
        drawCell(context, cell, x, y);
    });
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
}
