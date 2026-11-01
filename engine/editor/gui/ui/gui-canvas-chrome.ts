import type { GuiEmulatedScreen } from '@/engine/gui/devices/device-geometry';
import { hasGuiInsets } from '@/engine/gui/document/gui-document';
import type { GuiViewState } from '../gui-designer';
import { traceScreen } from './device/gui-device-frame';
export const RULER_SIZE = 20;
export interface ChromeColors {
    readonly background: string;
    readonly surface: string;
    readonly foreground: string;
    readonly muted: string;
    readonly primary: string;
    readonly border: string;
}
export function readChromeColors(element: HTMLElement): ChromeColors {
    const style = getComputedStyle(element);
    const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    return {
        background: token('--surface-sunken', '#101114'),
        surface: token('--surface', '#1a1b1f'),
        foreground: token('--foreground', '#d9dbe0'),
        muted: token('--muted-foreground', '#8a8f9c'),
        primary: token('--primary', '#4f9ddb'),
        border: token('--border-strong', 'rgba(255,255,255,0.07)'),
    };
}
let checkerPattern: {
    context: CanvasRenderingContext2D;
    pattern: CanvasPattern;
} | null = null;
function checker(context: CanvasRenderingContext2D): CanvasPattern | null {
    if (checkerPattern && checkerPattern.context === context)
        return checkerPattern.pattern;
    const tile = document.createElement('canvas');
    tile.width = 16;
    tile.height = 16;
    const tileContext = tile.getContext('2d');
    if (!tileContext)
        return null;
    tileContext.fillStyle = '#2a2d36';
    tileContext.fillRect(0, 0, 16, 16);
    tileContext.fillStyle = '#20232b';
    tileContext.fillRect(0, 0, 8, 8);
    tileContext.fillRect(8, 8, 8, 8);
    const pattern = context.createPattern(tile, 'repeat');
    if (!pattern)
        return null;
    checkerPattern = { context, pattern };
    return pattern;
}
export interface ChromeFrame {
    readonly width: number;
    readonly height: number;
    readonly view: GuiViewState;
    readonly screen: GuiEmulatedScreen;
    readonly colors: ChromeColors;
}
function screenRect(frame: ChromeFrame): {
    x: number;
    y: number;
    w: number;
    h: number;
} {
    const { view, screen } = frame;
    return { x: view.panX, y: view.panY, w: screen.width * view.zoom, h: screen.height * view.zoom };
}
export function drawWorkspaceBackground(context: CanvasRenderingContext2D, frame: ChromeFrame): void {
    context.fillStyle = frame.colors.background;
    context.fillRect(0, 0, frame.width, frame.height);
}
export function drawScreenShadow(context: CanvasRenderingContext2D, frame: ChromeFrame, cornerRadius: number): void {
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.55)';
    context.shadowBlur = 32;
    context.shadowOffsetY = 8;
    traceScreen(context, frame, cornerRadius);
    context.fillStyle = '#14161c';
    context.fill();
    context.restore();
}
export function drawScreenBackdrop(context: CanvasRenderingContext2D, frame: ChromeFrame, checkerboard: boolean): void {
    const { x, y, w, h } = screenRect(frame);
    const pattern = checkerboard ? checker(context) : null;
    if (pattern) {
        context.save();
        context.translate(x, y);
        context.fillStyle = pattern;
        context.fillRect(0, 0, w, h);
        context.restore();
    }
    else {
        context.fillStyle = '#0d1017';
        context.fillRect(x, y, w, h);
    }
}
export function drawGrid(context: CanvasRenderingContext2D, frame: ChromeFrame, step: number): void {
    const { view, screen } = frame;
    const css = step * view.zoom;
    if (css < 6)
        return;
    const { x: x0, y: y0, w, h } = screenRect(frame);
    context.save();
    context.beginPath();
    context.rect(x0, y0, w, h);
    context.clip();
    context.lineWidth = 1;
    const major = step * (css < 14 ? 8 : 4);
    context.beginPath();
    for (let gx = 0; gx <= screen.width; gx += step) {
        const px = Math.round(x0 + gx * view.zoom) + 0.5;
        context.moveTo(px, y0);
        context.lineTo(px, y0 + h);
    }
    for (let gy = 0; gy <= screen.height; gy += step) {
        const py = Math.round(y0 + gy * view.zoom) + 0.5;
        context.moveTo(x0, py);
        context.lineTo(x0 + w, py);
    }
    context.strokeStyle = 'rgba(255,255,255,0.045)';
    context.stroke();
    context.beginPath();
    for (let gx = 0; gx <= screen.width; gx += major) {
        const px = Math.round(x0 + gx * view.zoom) + 0.5;
        context.moveTo(px, y0);
        context.lineTo(px, y0 + h);
    }
    for (let gy = 0; gy <= screen.height; gy += major) {
        const py = Math.round(y0 + gy * view.zoom) + 0.5;
        context.moveTo(x0, py);
        context.lineTo(x0 + w, py);
    }
    context.strokeStyle = 'rgba(255,255,255,0.09)';
    context.stroke();
    context.restore();
}
export function drawSafeArea(context: CanvasRenderingContext2D, frame: ChromeFrame): void {
    const { view, screen, colors } = frame;
    if (!hasGuiInsets(screen.safeArea))
        return;
    const { top, right, bottom, left } = screen.safeArea;
    const outer = screenRect(frame);
    const x = Math.round(outer.x + left * view.zoom) + 0.5;
    const y = Math.round(outer.y + top * view.zoom) + 0.5;
    const w = Math.round((screen.width - left - right) * view.zoom);
    const h = Math.round((screen.height - top - bottom) * view.zoom);
    context.save();
    context.beginPath();
    context.rect(outer.x, outer.y, outer.w, outer.h);
    context.rect(x, y, w, h);
    context.fillStyle = colors.primary;
    context.globalAlpha = 0.1;
    context.fill('evenodd');
    context.globalAlpha = 0.7;
    context.setLineDash([6, 4]);
    context.lineWidth = 1;
    context.strokeStyle = colors.primary;
    context.strokeRect(x, y, w, h);
    context.restore();
}
function rulerStep(zoom: number): {
    minor: number;
    major: number;
} {
    const target = 80 / zoom;
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    const major = steps.find((step) => step >= target) ?? 5000;
    return { minor: major / (major % 5 === 0 && major !== 1 ? 5 : 2), major };
}
export function drawRulers(context: CanvasRenderingContext2D, frame: ChromeFrame, highlight: {
    x: number;
    y: number;
    width: number;
    height: number;
} | null): void {
    const { width, height, view, colors } = frame;
    const { minor, major } = rulerStep(view.zoom);
    context.save();
    context.fillStyle = colors.surface;
    context.fillRect(0, 0, width, RULER_SIZE);
    context.fillRect(0, 0, RULER_SIZE, height);
    if (highlight) {
        context.fillStyle = 'rgba(79,157,219,0.18)';
        context.fillRect(view.panX + highlight.x * view.zoom, 0, highlight.width * view.zoom, RULER_SIZE);
        context.fillRect(0, view.panY + highlight.y * view.zoom, RULER_SIZE, highlight.height * view.zoom);
    }
    context.strokeStyle = colors.border;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, RULER_SIZE + 0.5);
    context.lineTo(width, RULER_SIZE + 0.5);
    context.moveTo(RULER_SIZE + 0.5, 0);
    context.lineTo(RULER_SIZE + 0.5, height);
    context.stroke();
    context.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textBaseline = 'top';
    context.fillStyle = colors.muted;
    context.strokeStyle = 'rgba(255,255,255,0.22)';
    const firstX = Math.floor((RULER_SIZE - view.panX) / view.zoom / minor) * minor;
    const lastX = (width - view.panX) / view.zoom;
    context.beginPath();
    for (let value = firstX; value <= lastX; value += minor) {
        const px = Math.round(view.panX + value * view.zoom) + 0.5;
        if (px < RULER_SIZE)
            continue;
        const isMajor = Math.abs(value / major - Math.round(value / major)) < 1e-6;
        context.moveTo(px, RULER_SIZE);
        context.lineTo(px, isMajor ? 6 : 13);
        if (isMajor)
            context.fillText(String(Math.round(value)), px + 3, 2);
    }
    context.stroke();
    const firstY = Math.floor((RULER_SIZE - view.panY) / view.zoom / minor) * minor;
    const lastY = (height - view.panY) / view.zoom;
    context.beginPath();
    for (let value = firstY; value <= lastY; value += minor) {
        const py = Math.round(view.panY + value * view.zoom) + 0.5;
        if (py < RULER_SIZE)
            continue;
        const isMajor = Math.abs(value / major - Math.round(value / major)) < 1e-6;
        context.moveTo(RULER_SIZE, py);
        context.lineTo(isMajor ? 6 : 13, py);
        if (isMajor) {
            context.save();
            context.translate(2, py + 3);
            context.rotate(-Math.PI / 2);
            context.textAlign = 'right';
            context.fillText(String(Math.round(value)), 0, 0);
            context.restore();
        }
    }
    context.stroke();
    context.fillStyle = colors.surface;
    context.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
    context.restore();
}
