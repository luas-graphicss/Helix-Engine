import { clamp } from '@/engine/audio/core/decibels';
import type { AudioEditor } from '@/engine/editor/audio/audio-editor';
export const ZOOM_STEP_FACTOR = 1.6;
export function zoomAroundCursor(editor: AudioEditor, factor: number): void {
    if (editor.duration <= 0)
        return;
    const range = editor.visibleRange;
    const span = range.end - range.start;
    const anchor = clamp(editor.position, range.start, range.end);
    const nextSpan = span * factor;
    const start = anchor - (anchor - range.start) * (nextSpan / span);
    editor.setZoom({ start, end: start + nextSpan });
}
