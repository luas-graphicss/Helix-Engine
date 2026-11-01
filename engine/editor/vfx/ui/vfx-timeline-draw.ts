import { CANVAS_FONT, type CanvasTheme } from '@/engine/editor/animation/ui/canvas-theme';
import { drawDiamond, roundedRect } from '@/engine/editor/animation/ui/timeline-draw';
import type { VfxDocument } from '@/engine/vfx/document/vfx-document';
import { burstTimes, emitterWindow, formatVfxSeconds, tintToCss, VFX_ROW_HEIGHT, VFX_RULER_HEIGHT, vfxRulerTicks, vfxTimeToX, type VfxStackRow } from './vfx-stack-model';
const BAR_INSET = 5;
const MODULE_INSET = 9;
const BURST_SIZE = 3.5;
export function drawVfxRuler(ctx: CanvasRenderingContext2D, theme: CanvasTheme, width: number, document: VfxDocument): void {
    ctx.fillStyle = theme.surface;
    ctx.fillRect(0, 0, width, VFX_RULER_HEIGHT);
    ctx.fillStyle = theme.borderStrong;
    ctx.fillRect(0, VFX_RULER_HEIGHT - 1, width, 1);
    ctx.font = CANVAS_FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (const tick of vfxRulerTicks(document.duration, width)) {
        const x = Math.round(vfxTimeToX(tick.time, document.duration, width)) + 0.5;
        ctx.fillStyle = tick.major ? theme.muted : theme.borderStrong;
        ctx.fillRect(x - 0.5, VFX_RULER_HEIGHT - (tick.major ? 8 : 4), 1, tick.major ? 8 : 4);
        if (tick.major) {
            ctx.fillStyle = theme.muted;
            ctx.fillText(formatTick(tick.time), x + 3, 3);
        }
    }
    const endX = Math.round(vfxTimeToX(document.duration, document.duration, width)) + 0.5;
    ctx.fillStyle = document.loop ? theme.primary : theme.muted;
    ctx.fillRect(endX - 1, 2, 2, VFX_RULER_HEIGHT - 3);
}
function formatTick(time: number): string {
    return Number.isInteger(time) ? `${time}s` : `${Number(time.toFixed(2))}`;
}
export function drawVfxGrid(ctx: CanvasRenderingContext2D, theme: CanvasTheme, width: number, top: number, bottom: number, document: VfxDocument): void {
    for (const tick of vfxRulerTicks(document.duration, width)) {
        if (!tick.major)
            continue;
        const x = Math.round(vfxTimeToX(tick.time, document.duration, width)) + 0.5;
        ctx.fillStyle = theme.borderStrong;
        ctx.fillRect(x - 0.5, top, 1, bottom - top);
    }
}
export function drawVfxLanes(ctx: CanvasRenderingContext2D, theme: CanvasTheme, width: number, rows: readonly VfxStackRow[], document: VfxDocument, scrollTop: number, height: number): void {
    rows.forEach((row, index) => {
        const top = VFX_RULER_HEIGHT + index * VFX_ROW_HEIGHT - scrollTop;
        if (top + VFX_ROW_HEIGHT < VFX_RULER_HEIGHT || top > height)
            return;
        ctx.fillStyle = theme.borderStrong;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, top + VFX_ROW_HEIGHT - 1, width, 1);
        ctx.globalAlpha = 1;
        if (row.selected) {
            ctx.fillStyle = theme.primary;
            ctx.globalAlpha = 0.08;
            ctx.fillRect(0, top, width, VFX_ROW_HEIGHT);
            ctx.globalAlpha = 1;
        }
        const { emitter } = row;
        const window = emitterWindow(emitter, document);
        const x0 = vfxTimeToX(window.start, document.duration, width);
        const x1 = vfxTimeToX(window.end, document.duration, width);
        const enabled = emitter.enabled && (row.kind === 'emitter' || row.module.enabled);
        if (row.kind === 'emitter') {
            const barTop = top + BAR_INSET;
            const barHeight = VFX_ROW_HEIGHT - BAR_INSET * 2;
            ctx.fillStyle = tintToCss(emitter.tint, enabled ? 0.85 : 0.25);
            roundedRect(ctx, x0, barTop, Math.max(2, x1 - x0), barHeight, 2);
            ctx.fill();
            if (row.selected) {
                ctx.strokeStyle = theme.foreground;
                ctx.lineWidth = 1;
                roundedRect(ctx, x0 + 0.5, barTop + 0.5, Math.max(2, x1 - x0) - 1, barHeight - 1, 2);
                ctx.stroke();
            }
            if (emitter.loop && document.loop && window.end >= document.duration - 1e-6) {
                ctx.fillStyle = theme.surfaceSunken;
                ctx.globalAlpha = 0.5;
                ctx.fillRect(x1 - 3, barTop + 2, 1, barHeight - 4);
                ctx.globalAlpha = 1;
            }
            const centerY = top + VFX_ROW_HEIGHT / 2;
            for (const burst of emitter.spawn.bursts) {
                for (const time of burstTimes(burst, window)) {
                    const x = vfxTimeToX(time, document.duration, width);
                    ctx.fillStyle = enabled ? theme.foreground : theme.muted;
                    drawDiamond(ctx, x, centerY, BURST_SIZE);
                    ctx.fill();
                    ctx.strokeStyle = theme.surfaceSunken;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
        else {
            ctx.fillStyle = tintToCss(emitter.tint, enabled ? 0.22 : 0.08);
            roundedRect(ctx, x0, top + MODULE_INSET, Math.max(2, x1 - x0), VFX_ROW_HEIGHT - MODULE_INSET * 2, 1.5);
            ctx.fill();
        }
    });
}
export function drawVfxPlayhead(ctx: CanvasRenderingContext2D, theme: CanvasTheme, x: number, height: number, time: number): void {
    const px = Math.round(x) + 0.5;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, VFX_RULER_HEIGHT - 6);
    ctx.lineTo(px, height);
    ctx.stroke();
    ctx.font = CANVAS_FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const label = formatVfxSeconds(time);
    const textWidth = Math.ceil(ctx.measureText(label).width) + 8;
    ctx.fillStyle = theme.primary;
    roundedRect(ctx, Math.round(x - textWidth / 2), 2, textWidth, 14, 2);
    ctx.fill();
    ctx.fillStyle = theme.surfaceSunken;
    ctx.fillText(label, x, 9.5);
}
