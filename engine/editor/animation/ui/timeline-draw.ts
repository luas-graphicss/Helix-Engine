import type { AnimationEvent } from '@/engine/core/animation/animation-document';
import { CANVAS_FONT, type CanvasTheme } from './canvas-theme';
import { RULER_HEIGHT, rulerTicks, timeToX } from './timeline-model';
export interface RulerOptions {
    readonly width: number;
    readonly duration: number;
    readonly frameRate: number;
    readonly events: readonly AnimationEvent[];
    readonly selectedEvent: number;
    readonly hoveredEvent: number;
}
export const EVENT_MARKER_HALF_WIDTH = 4;
export function drawRuler(ctx: CanvasRenderingContext2D, theme: CanvasTheme, options: RulerOptions): void {
    const { width, duration, frameRate } = options;
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    ctx.fillStyle = theme.borderStrong;
    ctx.fillRect(0, RULER_HEIGHT - 1, width, 1);
    ctx.font = CANVAS_FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (const tick of rulerTicks(duration, frameRate, width)) {
        const x = Math.round(timeToX(tick.time, duration, width)) + 0.5;
        ctx.fillStyle = tick.major ? theme.muted : theme.borderStrong;
        ctx.fillRect(x - 0.5, RULER_HEIGHT - (tick.major ? 8 : 4), 1, tick.major ? 8 : 4);
        if (tick.major) {
            ctx.fillStyle = theme.muted;
            ctx.fillText(String(tick.frame), x + 3, 2);
        }
    }
    options.events.forEach((event, index) => {
        const x = timeToX(event.time, duration, width);
        const active = index === options.selectedEvent;
        const hovered = index === options.hoveredEvent;
        ctx.fillStyle = active ? theme.foreground : theme.warning;
        ctx.beginPath();
        ctx.moveTo(x, RULER_HEIGHT - 1);
        ctx.lineTo(x - EVENT_MARKER_HALF_WIDTH, RULER_HEIGHT - 1 - EVENT_MARKER_HALF_WIDTH * 1.6);
        ctx.lineTo(x + EVENT_MARKER_HALF_WIDTH, RULER_HEIGHT - 1 - EVENT_MARKER_HALF_WIDTH * 1.6);
        ctx.closePath();
        ctx.fill();
        if (active || hovered) {
            ctx.strokeStyle = theme.foreground;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}
export function drawPlayhead(ctx: CanvasRenderingContext2D, theme: CanvasTheme, x: number, height: number, label: string): void {
    const px = Math.round(x) + 0.5;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, RULER_HEIGHT - 6);
    ctx.lineTo(px, height);
    ctx.stroke();
    ctx.font = CANVAS_FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const textWidth = Math.ceil(ctx.measureText(label).width) + 8;
    const boxX = Math.round(x - textWidth / 2);
    ctx.fillStyle = theme.primary;
    roundedRect(ctx, boxX, 2, textWidth, 14, 2);
    ctx.fill();
    ctx.fillStyle = theme.surfaceSunken;
    ctx.fillText(label, x, 9.5);
}
export function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
}
export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}
export function drawTimeGrid(ctx: CanvasRenderingContext2D, theme: CanvasTheme, width: number, top: number, bottom: number, duration: number, frameRate: number): void {
    for (const tick of rulerTicks(duration, frameRate, width)) {
        const x = Math.round(timeToX(tick.time, duration, width)) + 0.5;
        ctx.fillStyle = theme.borderStrong;
        ctx.globalAlpha = tick.major ? 1 : 0.45;
        ctx.fillRect(x - 0.5, top, 1, bottom - top);
    }
    ctx.globalAlpha = 1;
}
export function hitTestEvent(events: readonly AnimationEvent[], x: number, y: number, duration: number, width: number): number {
    if (y > RULER_HEIGHT || y < RULER_HEIGHT - EVENT_MARKER_HALF_WIDTH * 2.2)
        return -1;
    let best = -1;
    let bestDistance = EVENT_MARKER_HALF_WIDTH + 2;
    events.forEach((event, index) => {
        const distance = Math.abs(timeToX(event.time, duration, width) - x);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
        }
    });
    return best;
}
export function niceStep(range: number, targetDivisions: number): number {
    const rough = range / Math.max(1, targetDivisions);
    if (!(rough > 0))
        return 1;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
    return nice * magnitude;
}
