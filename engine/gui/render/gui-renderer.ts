import type { GuiAppearance, GuiGradient, GuiMediaBlend, GuiNode, GuiPoint, GuiRadii, GuiShadow, GuiStateStyle, GuiTextStyle, GuiVideoControl, GuiVideoFit, GuiViewportControl } from '@/engine/gui/document/gui-document';
import { orderedGuiChildren } from '@/engine/gui/document/gui-tree';
import type { GuiFontRegistry } from '@/engine/gui/fonts/gui-font-registry';
import type { GuiIconCatalog } from '@/engine/gui/icons/gui-icon-catalog';
import type { GuiImageCache, GuiImageSource } from '@/engine/gui/images/gui-image-cache';
import type { GuiBox, GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { matrixMultiply, matrixScaleFactor, type GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import type { GuiVideoCache } from '@/engine/gui/media/gui-video-cache';
import type { GuiViewDescription, GuiViewportProvider } from '@/engine/gui/media/gui-viewport-provider';
import type { GuiTextLayout } from '@/engine/gui/text/gui-text-measure';
export type GuiRuntimeValue = boolean | number | string;
export interface GuiRenderState {
    readonly hovered: string | null;
    readonly pressed: string | null;
    readonly focused: string | null;
    readonly values: ReadonlyMap<string, GuiRuntimeValue>;
    readonly scroll: ReadonlyMap<string, GuiPoint>;
    readonly time: number;
}
export interface GuiRenderOptions {
    readonly base: GuiMatrix;
    readonly images: GuiImageCache;
    readonly icons: GuiIconCatalog;
    readonly fonts: GuiFontRegistry;
    readonly state: GuiRenderState | null;
    readonly placeholders: boolean;
    readonly videos?: GuiVideoCache | null;
    readonly mediaScope?: string;
    readonly viewports?: GuiViewportProvider | null;
    readonly elapsedSeconds?: number;
}
export function guiMediaKey(scope: string | undefined, nodeId: string): string {
    return `${scope ?? 'gui'}:${nodeId}`;
}
const BLEND_OPERATION: Record<GuiMediaBlend, GlobalCompositeOperation> = {
    normal: 'source-over',
    screen: 'screen',
    multiply: 'multiply',
    add: 'lighter',
    overlay: 'overlay',
};
export const VIEWPORT_YAW_KEY = ':yaw';
export const VIEWPORT_PITCH_KEY = ':pitch';
export const VIEWPORT_ZOOM_KEY = ':zoom';
export const VIDEO_PLAYING_KEY = ':playing';
export function viewportDescription(control: GuiViewportControl, nodeId: string, state: GuiRenderState | null): GuiViewDescription {
    const value = (suffix: string) => {
        const stored = state?.values.get(nodeId + suffix);
        return typeof stored === 'number' && Number.isFinite(stored) ? stored : 0;
    };
    return {
        camera: control.camera,
        cameraName: control.cameraName,
        targetName: control.targetName,
        distance: control.distance,
        yaw: control.yaw,
        pitch: control.pitch,
        autoRotate: control.autoRotate,
        fov: control.fov,
        resolutionScale: control.resolutionScale,
        frameRate: control.frameRate,
        grid: control.grid,
        yawOffset: value(VIEWPORT_YAW_KEY),
        pitchOffset: value(VIEWPORT_PITCH_KEY),
        distanceScale: Math.max(control.minDistance / Math.max(control.distance, 1e-3), Math.min(control.maxDistance / Math.max(control.distance, 1e-3), Math.exp(value(VIEWPORT_ZOOM_KEY)))),
    };
}
export function fitMediaBox(fit: GuiVideoFit, sourceWidth: number, sourceHeight: number, box: GuiBox): GuiBox {
    if (fit === 'stretch' || sourceWidth <= 0 || sourceHeight <= 0)
        return box;
    const ratio = fit === 'contain' ? Math.min(box.width / sourceWidth, box.height / sourceHeight) : Math.max(box.width / sourceWidth, box.height / sourceHeight);
    const width = sourceWidth * ratio;
    const height = sourceHeight * ratio;
    return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}
type SpacingContext = CanvasRenderingContext2D & {
    letterSpacing?: string;
};
export function withAlpha(hex: string, alpha: number): string {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
export function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radii: GuiRadii): void {
    const limit = Math.min(width, height) / 2;
    const [tl, tr, br, bl] = radii.map((radius) => Math.max(0, Math.min(limit, radius)));
    context.beginPath();
    context.moveTo(x + tl, y);
    context.lineTo(x + width - tr, y);
    if (tr > 0)
        context.arcTo(x + width, y, x + width, y + tr, tr);
    context.lineTo(x + width, y + height - br);
    if (br > 0)
        context.arcTo(x + width, y + height, x + width - br, y + height, br);
    context.lineTo(x + bl, y + height);
    if (bl > 0)
        context.arcTo(x, y + height, x, y + height - bl, bl);
    context.lineTo(x, y + tl);
    if (tl > 0)
        context.arcTo(x, y, x + tl, y, tl);
    context.closePath();
}
function gradientStyle(context: CanvasRenderingContext2D, gradient: GuiGradient, box: GuiBox): CanvasGradient {
    let canvasGradient: CanvasGradient;
    if (gradient.kind === 'radial') {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        canvasGradient = context.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(box.width, box.height) / 2);
    }
    else {
        const radians = ((gradient.angle - 90) * Math.PI) / 180;
        const dx = Math.cos(radians);
        const dy = Math.sin(radians);
        const half = (Math.abs(dx) * box.width + Math.abs(dy) * box.height) / 2;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        canvasGradient = context.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    }
    for (const stop of gradient.stops)
        canvasGradient.addColorStop(Math.max(0, Math.min(1, stop.offset)), withAlpha(stop.color, stop.alpha));
    return canvasGradient;
}
function applyShadow(context: CanvasRenderingContext2D, shadow: GuiShadow | null, scale: number): void {
    if (!shadow || shadow.alpha <= 0) {
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        return;
    }
    context.shadowColor = withAlpha(shadow.color, shadow.alpha);
    context.shadowBlur = shadow.blur * scale;
    context.shadowOffsetX = shadow.offsetX * scale;
    context.shadowOffsetY = shadow.offsetY * scale;
}
function clearShadow(context: CanvasRenderingContext2D): void {
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
}
export function effectiveAppearance(appearance: GuiAppearance, state: GuiStateStyle | null): GuiAppearance {
    if (!state)
        return appearance;
    return {
        ...appearance,
        fill: { ...appearance.fill, color: state.fillColor ?? appearance.fill.color, alpha: state.fillAlpha ?? appearance.fill.alpha, gradient: state.fillColor ? null : appearance.fill.gradient },
        stroke: appearance.stroke && state.strokeColor ? { ...appearance.stroke, color: state.strokeColor } : appearance.stroke,
        opacity: state.opacity ?? appearance.opacity,
    };
}
export function activeStateStyle(node: GuiNode, state: GuiRenderState | null): GuiStateStyle | null {
    const disabled = node.control?.kind === 'button' && node.control.disabled;
    if (disabled)
        return node.states.disabled;
    if (!state || !node.interactable)
        return null;
    if (state.pressed === node.id)
        return node.states.pressed ?? node.states.hover;
    if (state.hovered === node.id)
        return node.states.hover;
    return null;
}
class Renderer {
    private readonly context: SpacingContext;
    private scratch: HTMLCanvasElement | null = null;
    constructor(context: CanvasRenderingContext2D, private readonly layout: GuiLayoutResult, private readonly options: GuiRenderOptions) {
        this.context = context as SpacingContext;
    }
    run(): void {
        const { context } = this;
        context.save();
        this.drawNode(this.layout.document.root, 1);
        context.restore();
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
    private value<T extends GuiRuntimeValue>(node: GuiNode, fallback: T): T {
        const value = this.options.state?.values.get(node.id);
        return value !== undefined && typeof value === typeof fallback ? (value as T) : fallback;
    }
    private drawNode(node: GuiNode, parentAlpha: number): void {
        const entry = this.layout.entries.get(node.id);
        if (!entry)
            return;
        const { context } = this;
        const stateStyle = activeStateStyle(node, this.options.state);
        const appearance = effectiveAppearance(node.appearance, stateStyle);
        const alpha = parentAlpha * appearance.opacity;
        if (alpha <= 0)
            return;
        let world = entry.world;
        if (stateStyle && stateStyle.scale !== 1) {
            const cx = entry.width / 2;
            const cy = entry.height / 2;
            world = matrixMultiply(world, [stateStyle.scale, 0, 0, stateStyle.scale, cx - cx * stateStyle.scale, cy - cy * stateStyle.scale]);
        }
        const matrix = matrixMultiply(this.options.base, world);
        const scale = matrixScaleFactor(matrix);
        const s = this.layout.offsetScale;
        context.save();
        context.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
        context.globalAlpha = alpha;
        const radii = node.appearance.radii.map((radius) => radius * s) as unknown as GuiRadii;
        const box: GuiBox = { x: 0, y: 0, width: entry.width, height: entry.height };
        this.drawBackground(appearance, box, radii, scale);
        this.drawContent(node, entry, stateStyle, box, radii, scale);
        const clips = node.clipsContent || node.kind === 'scroll';
        if (clips) {
            roundedRectPath(context, 0, 0, entry.width, entry.height, radii);
            context.clip();
        }
        for (const child of orderedGuiChildren(node))
            this.drawNode(child, alpha);
        if (node.kind === 'scroll')
            this.drawScrollbar(node, entry, matrix);
        context.restore();
        if (appearance.stroke && appearance.stroke.width > 0 && appearance.stroke.alpha > 0) {
            context.save();
            context.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
            context.globalAlpha = alpha;
            this.drawStroke(appearance, box, radii);
            context.restore();
        }
    }
    private drawBackground(appearance: GuiAppearance, box: GuiBox, radii: GuiRadii, scale: number): void {
        const { context } = this;
        const { fill } = appearance;
        if (!fill.gradient && fill.alpha <= 0)
            return;
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        applyShadow(context, appearance.shadow, scale);
        context.fillStyle = fill.gradient ? gradientStyle(context, fill.gradient, box) : withAlpha(fill.color, fill.alpha);
        context.fill();
        clearShadow(context);
    }
    private drawStroke(appearance: GuiAppearance, box: GuiBox, radii: GuiRadii): void {
        const { context } = this;
        const stroke = appearance.stroke;
        if (!stroke)
            return;
        const width = stroke.width * this.layout.offsetScale;
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        context.save();
        context.clip();
        context.lineWidth = width * 2;
        context.strokeStyle = withAlpha(stroke.color, stroke.alpha);
        context.stroke();
        context.restore();
    }
    private drawContent(node: GuiNode, entry: GuiLayoutEntry, stateStyle: GuiStateStyle | null, box: GuiBox, radii: GuiRadii, scale: number): void {
        switch (node.kind) {
            case 'image':
                if (node.image)
                    this.drawImage(node, box, radii);
                break;
            case 'icon':
                if (node.icon)
                    this.drawIcon(node.icon.name, node.icon.color, node.icon.alpha, node.icon.strokeWidth, box, Math.min(box.width, box.height), (box.width - Math.min(box.width, box.height)) / 2, (box.height - Math.min(box.width, box.height)) / 2);
                break;
            case 'button':
                this.drawButton(node, entry, stateStyle, box, scale);
                break;
            case 'toggle':
                this.drawToggle(node, box);
                break;
            case 'slider':
                this.drawSlider(node, box);
                break;
            case 'progress':
                this.drawProgress(node, entry, radii, box, scale);
                break;
            case 'input':
                this.drawInput(node, entry, scale);
                break;
            case 'divider':
                this.drawDivider(node, box);
                break;
            case 'text':
                if (node.text && entry.textLayout && entry.textBox)
                    this.drawText(node.text, entry.textLayout, entry.textBox, stateStyle?.textColor ?? null, scale);
                break;
            case 'video':
                if (node.control?.kind === 'video')
                    this.drawVideo(node, node.control, box, radii, scale);
                break;
            case 'viewport':
                if (node.control?.kind === 'viewport')
                    this.drawViewport(node, node.control, box, radii, scale);
                break;
            default:
                break;
        }
    }
    private drawVideo(node: GuiNode, control: GuiVideoControl, box: GuiBox, radii: GuiRadii, scale: number): void {
        const { context } = this;
        const handle = control.assetId && this.options.videos ? this.options.videos.acquire(guiMediaKey(this.options.mediaScope, node.id), control.assetId) : null;
        const frame = handle?.frame ?? null;
        const poster = !frame && control.posterAssetId ? this.options.images.get(control.posterAssetId) : null;
        const source: CanvasImageSource | null = frame ?? poster;
        context.save();
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        context.clip();
        if (!source) {
            if (this.options.placeholders || !control.assetId || handle?.failed)
                this.drawMediaPlaceholder(box, 'video', handle?.failed ?? control.assetId === null);
            context.restore();
            return;
        }
        const sourceWidth = frame ? frame.videoWidth : (source as GuiImageSource).width;
        const sourceHeight = frame ? frame.videoHeight : (source as GuiImageSource).height;
        const target = fitMediaBox(control.fit, sourceWidth, sourceHeight, box);
        context.globalCompositeOperation = BLEND_OPERATION[control.blend];
        context.imageSmoothingQuality = 'high';
        if (control.flipX || control.flipY) {
            context.save();
            context.translate(control.flipX ? box.x * 2 + box.width : 0, control.flipY ? box.y * 2 + box.height : 0);
            context.scale(control.flipX ? -1 : 1, control.flipY ? -1 : 1);
            context.drawImage(source, target.x, target.y, target.width, target.height);
            context.restore();
        }
        else {
            context.drawImage(source, target.x, target.y, target.width, target.height);
        }
        context.globalCompositeOperation = 'source-over';
        if (control.tintAlpha > 0) {
            context.fillStyle = withAlpha(control.tint, control.tintAlpha);
            context.fillRect(box.x, box.y, box.width, box.height);
        }
        if (control.showControls && handle)
            this.drawVideoControls(handle.playing, handle.duration > 0 ? handle.currentTime / handle.duration : 0, box, scale);
        context.restore();
    }
    private drawVideoControls(playing: boolean, progress: number, box: GuiBox, scale: number): void {
        const { context } = this;
        const s = this.layout.offsetScale;
        const height = Math.min(box.height * 0.22, 36 * s);
        const y = box.y + box.height - height;
        const gradient = context.createLinearGradient(0, y, 0, box.y + box.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
        context.fillStyle = gradient;
        context.fillRect(box.x, y, box.width, height);
        const pad = height * 0.3;
        const glyph = height * 0.42;
        const cx = box.x + pad + glyph / 2;
        const cy = y + height / 2;
        context.fillStyle = 'rgba(255,255,255,0.92)';
        context.beginPath();
        if (playing) {
            const bar = glyph * 0.3;
            context.rect(cx - glyph / 2, cy - glyph / 2, bar, glyph);
            context.rect(cx + glyph / 2 - bar, cy - glyph / 2, bar, glyph);
        }
        else {
            context.moveTo(cx - glyph * 0.4, cy - glyph / 2);
            context.lineTo(cx + glyph * 0.55, cy);
            context.lineTo(cx - glyph * 0.4, cy + glyph / 2);
            context.closePath();
        }
        context.fill();
        const trackX = cx + glyph / 2 + pad;
        const trackWidth = Math.max(0, box.x + box.width - pad - trackX);
        const thickness = Math.max(1, 2 * s * Math.min(1, scale));
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(trackX, cy - thickness / 2, trackWidth, thickness);
        context.fillStyle = 'rgba(255,255,255,0.95)';
        context.fillRect(trackX, cy - thickness / 2, trackWidth * Math.max(0, Math.min(1, progress)), thickness);
    }
    private drawViewport(node: GuiNode, control: GuiViewportControl, box: GuiBox, radii: GuiRadii, scale: number): void {
        const { context } = this;
        const provider = this.options.viewports ?? null;
        const pixelWidth = Math.max(1, Math.round(box.width * scale));
        const pixelHeight = Math.max(1, Math.round(box.height * scale));
        const frame = provider ? provider.frame(guiMediaKey(this.options.mediaScope, node.id), viewportDescription(control, node.id, this.options.state), pixelWidth, pixelHeight, this.options.elapsedSeconds ?? 0) : null;
        context.save();
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        context.clip();
        if (!frame) {
            this.drawMediaPlaceholder(box, 'viewport', false);
            context.restore();
            return;
        }
        context.globalCompositeOperation = BLEND_OPERATION[control.blend];
        context.imageSmoothingQuality = 'high';
        context.drawImage(frame, box.x, box.y, box.width, box.height);
        context.globalCompositeOperation = 'source-over';
        if (control.tintAlpha > 0) {
            context.fillStyle = withAlpha(control.tint, control.tintAlpha);
            context.fillRect(box.x, box.y, box.width, box.height);
        }
        context.restore();
    }
    private drawMediaPlaceholder(box: GuiBox, kind: 'video' | 'viewport', failed: boolean): void {
        const { context } = this;
        context.fillStyle = failed ? 'rgba(255, 92, 108, 0.14)' : 'rgba(0, 0, 0, 0.35)';
        context.fillRect(box.x, box.y, box.width, box.height);
        const step = Math.max(12, Math.min(box.width, box.height) / 6);
        context.strokeStyle = 'rgba(255,255,255,0.06)';
        context.lineWidth = 1;
        context.beginPath();
        for (let x = box.x + step; x < box.x + box.width; x += step) {
            context.moveTo(x, box.y);
            context.lineTo(x, box.y + box.height);
        }
        for (let y = box.y + step; y < box.y + box.height; y += step) {
            context.moveTo(box.x, y);
            context.lineTo(box.x + box.width, y);
        }
        context.stroke();
        const side = Math.min(box.width, box.height) * 0.28;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        context.strokeStyle = failed ? 'rgba(255, 92, 108, 0.8)' : 'rgba(255,255,255,0.45)';
        context.fillStyle = context.strokeStyle;
        context.lineWidth = Math.max(1.5, side * 0.08);
        context.lineJoin = 'round';
        context.beginPath();
        if (kind === 'video') {
            context.moveTo(cx - side * 0.35, cy - side * 0.5);
            context.lineTo(cx + side * 0.55, cy);
            context.lineTo(cx - side * 0.35, cy + side * 0.5);
            context.closePath();
            context.fill();
        }
        else {
            context.roundRect(cx - side * 0.6, cy - side * 0.4, side * 0.85, side * 0.8, side * 0.1);
            context.moveTo(cx + side * 0.25, cy - side * 0.1);
            context.lineTo(cx + side * 0.6, cy - side * 0.3);
            context.lineTo(cx + side * 0.6, cy + side * 0.3);
            context.lineTo(cx + side * 0.25, cy + side * 0.1);
            context.stroke();
        }
    }
    private drawText(style: GuiTextStyle, textLayout: GuiTextLayout, box: GuiBox, colorOverride: string | null, scale: number, contentOverride: readonly string[] | null = null): void {
        const { context } = this;
        const lines = contentOverride ?? textLayout.lines;
        if (lines.length === 0 || (lines.length === 1 && lines[0] === ''))
            return;
        context.font = textLayout.font;
        if ('letterSpacing' in context)
            context.letterSpacing = `${style.letterSpacing * this.layout.offsetScale * (textLayout.fontSize / Math.max(1, style.size * this.layout.offsetScale))}px`;
        context.textBaseline = 'middle';
        context.textAlign = style.align;
        const totalHeight = lines.length * textLayout.lineHeight;
        const startY = style.verticalAlign === 'top' ? box.y : style.verticalAlign === 'bottom' ? box.y + box.height - totalHeight : box.y + (box.height - totalHeight) / 2;
        const x = style.align === 'left' ? box.x : style.align === 'right' ? box.x + box.width : box.x + box.width / 2;
        context.save();
        if (!contentOverride) {
            context.beginPath();
            context.rect(box.x - 2, box.y - textLayout.lineHeight, box.width + 4, box.height + textLayout.lineHeight * 2);
            context.clip();
        }
        applyShadow(context, style.shadow, scale);
        const fill = withAlpha(colorOverride ?? style.color, style.alpha);
        lines.forEach((line, index) => {
            const y = startY + (index + 0.5) * textLayout.lineHeight;
            if (style.outline && style.outline.width > 0) {
                context.lineJoin = 'round';
                context.lineWidth = style.outline.width * 2 * this.layout.offsetScale;
                context.strokeStyle = withAlpha(style.outline.color, style.outline.alpha);
                context.strokeText(line, x, y);
            }
            context.fillStyle = fill;
            context.fillText(line, x, y);
        });
        clearShadow(context);
        context.restore();
        if ('letterSpacing' in context)
            context.letterSpacing = '0px';
    }
    private drawIcon(name: string, color: string, alpha: number, strokeWidth: number, box: GuiBox, side: number, offsetX: number, offsetY: number): void {
        const { context } = this;
        context.save();
        context.globalAlpha *= alpha;
        const drawn = this.options.icons.draw(context, name, box.x + offsetX, box.y + offsetY, side, color, strokeWidth);
        if (!drawn && this.options.placeholders) {
            context.setLineDash([4, 4]);
            context.lineWidth = 1;
            context.strokeStyle = withAlpha(color, 0.5);
            context.strokeRect(box.x + offsetX + 2, box.y + offsetY + 2, side - 4, side - 4);
            context.setLineDash([]);
        }
        context.restore();
    }
    private drawButton(node: GuiNode, entry: GuiLayoutEntry, stateStyle: GuiStateStyle | null, box: GuiBox, scale: number): void {
        const control = node.control?.kind === 'button' ? node.control : null;
        const s = this.layout.offsetScale;
        if (control?.iconName) {
            const size = control.iconSize * s;
            const color = stateStyle?.textColor ?? node.text?.color ?? '#ffffff';
            let x = box.x + (box.width - size) / 2;
            let y = box.y + (box.height - size) / 2;
            if (control.iconPosition !== 'only' && entry.textBox && entry.textLayout) {
                const gap = control.iconGap * s;
                const textWidth = Math.min(entry.textLayout.width, entry.textBox.width);
                if (control.iconPosition === 'left') {
                    const align = node.text?.align ?? 'center';
                    const textStart = align === 'left' ? entry.textBox.x : align === 'right' ? entry.textBox.x + entry.textBox.width - textWidth : entry.textBox.x + (entry.textBox.width - textWidth) / 2;
                    x = textStart - gap - size;
                }
                else if (control.iconPosition === 'right') {
                    const align = node.text?.align ?? 'center';
                    const textEnd = align === 'left' ? entry.textBox.x + textWidth : align === 'right' ? entry.textBox.x + entry.textBox.width : entry.textBox.x + (entry.textBox.width + textWidth) / 2;
                    x = textEnd + gap;
                }
                else {
                    y = entry.textBox.y - gap - size;
                }
            }
            this.drawIcon(control.iconName, color, 1, 2, { x, y, width: size, height: size }, size, 0, 0);
        }
        if (node.text && entry.textLayout && entry.textBox && control?.iconPosition !== 'only')
            this.drawText(node.text, entry.textLayout, entry.textBox, stateStyle?.textColor ?? null, scale);
    }
    private drawToggle(node: GuiNode, box: GuiBox): void {
        const control = node.control?.kind === 'toggle' ? node.control : null;
        if (!control)
            return;
        const { context } = this;
        const on = this.value(node, control.value);
        if (control.style === 'checkbox') {
            const side = Math.min(box.width, box.height);
            const x = box.x + (box.width - side) / 2;
            const y = box.y + (box.height - side) / 2;
            roundedRectPath(context, x, y, side, side, [side * 0.22, side * 0.22, side * 0.22, side * 0.22]);
            context.fillStyle = on ? control.onColor : withAlpha('#ffffff', 0.12);
            context.fill();
            if (!on) {
                context.lineWidth = Math.max(1, side * 0.08);
                context.strokeStyle = withAlpha('#ffffff', 0.35);
                context.stroke();
            }
            else {
                context.beginPath();
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.lineWidth = Math.max(1.5, side * 0.12);
                context.strokeStyle = control.knobColor;
                context.moveTo(x + side * 0.26, y + side * 0.52);
                context.lineTo(x + side * 0.43, y + side * 0.7);
                context.lineTo(x + side * 0.75, y + side * 0.32);
                context.stroke();
            }
            return;
        }
        const height = Math.min(box.height, box.width / 1.6);
        const width = height * 1.8;
        const x = box.x + (box.width - width) / 2;
        const y = box.y + (box.height - height) / 2;
        roundedRectPath(context, x, y, width, height, [height / 2, height / 2, height / 2, height / 2]);
        context.fillStyle = on ? control.onColor : withAlpha('#ffffff', 0.18);
        context.fill();
        const knob = height * 0.78;
        const pad = (height - knob) / 2;
        const knobX = on ? x + width - pad - knob : x + pad;
        context.beginPath();
        context.arc(knobX + knob / 2, y + height / 2, knob / 2, 0, Math.PI * 2);
        context.fillStyle = control.knobColor;
        context.shadowColor = 'rgba(0,0,0,0.3)';
        context.shadowBlur = knob * 0.3;
        context.fill();
        clearShadow(context);
    }
    private drawSlider(node: GuiNode, box: GuiBox): void {
        const control = node.control?.kind === 'slider' ? node.control : null;
        if (!control)
            return;
        const { context } = this;
        const s = this.layout.offsetScale;
        const value = this.value(node, control.value);
        const fraction = control.max > control.min ? (value - control.min) / (control.max - control.min) : 0;
        const thickness = control.trackThickness * s;
        const knob = control.knobSize * s;
        const horizontal = control.direction === 'horizontal';
        const radius: GuiRadii = [thickness / 2, thickness / 2, thickness / 2, thickness / 2];
        if (horizontal) {
            const y = box.y + (box.height - thickness) / 2;
            const x0 = box.x + knob / 2;
            const length = Math.max(0, box.width - knob);
            roundedRectPath(context, x0, y, length, thickness, radius);
            context.fillStyle = withAlpha(control.trackColor, control.trackAlpha);
            context.fill();
            roundedRectPath(context, x0, y, length * fraction, thickness, radius);
            context.fillStyle = control.fillColor;
            context.fill();
            this.drawKnob(x0 + length * fraction, box.y + box.height / 2, knob, control.knobColor);
        }
        else {
            const x = box.x + (box.width - thickness) / 2;
            const y0 = box.y + knob / 2;
            const length = Math.max(0, box.height - knob);
            roundedRectPath(context, x, y0, thickness, length, radius);
            context.fillStyle = withAlpha(control.trackColor, control.trackAlpha);
            context.fill();
            roundedRectPath(context, x, y0 + length * (1 - fraction), thickness, length * fraction, radius);
            context.fillStyle = control.fillColor;
            context.fill();
            this.drawKnob(box.x + box.width / 2, y0 + length * (1 - fraction), knob, control.knobColor);
        }
    }
    private drawKnob(x: number, y: number, size: number, color: string): void {
        const { context } = this;
        context.beginPath();
        context.arc(x, y, size / 2, 0, Math.PI * 2);
        context.fillStyle = color;
        context.shadowColor = 'rgba(0,0,0,0.35)';
        context.shadowBlur = size * 0.4;
        context.shadowOffsetY = size * 0.1;
        context.fill();
        clearShadow(context);
    }
    private drawProgress(node: GuiNode, entry: GuiLayoutEntry, radii: GuiRadii, box: GuiBox, scale: number): void {
        const control = node.control?.kind === 'progress' ? node.control : null;
        if (!control)
            return;
        const { context } = this;
        const value = Math.max(0, Math.min(1, this.value(node, control.value)));
        const horizontal = control.direction === 'horizontal';
        context.save();
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        context.clip();
        const fillStyle = control.fillGradient ? gradientStyle(context, control.fillGradient, box) : withAlpha(control.fillColor, control.fillAlpha);
        context.fillStyle = fillStyle;
        if (control.segments > 1) {
            const gap = Math.max(1, 2 * this.layout.offsetScale);
            const count = control.segments;
            const length = horizontal ? box.width : box.height;
            const segment = (length - gap * (count - 1)) / count;
            const filled = value * count;
            for (let index = 0; index < count; index++) {
                const amount = Math.max(0, Math.min(1, filled - index));
                if (amount <= 0)
                    continue;
                const start = index * (segment + gap);
                if (horizontal) {
                    const x = control.reverse ? box.x + box.width - start - segment * amount : box.x + start;
                    context.fillRect(x, box.y, segment * amount, box.height);
                }
                else {
                    const y = control.reverse ? box.y + start : box.y + box.height - start - segment * amount;
                    context.fillRect(box.x, y, box.width, segment * amount);
                }
            }
        }
        else if (horizontal) {
            const width = box.width * value;
            context.fillRect(control.reverse ? box.x + box.width - width : box.x, box.y, width, box.height);
        }
        else {
            const height = box.height * value;
            context.fillRect(box.x, control.reverse ? box.y : box.y + box.height - height, box.width, height);
        }
        context.restore();
        if (control.showLabel && node.text && entry.textLayout && entry.textBox) {
            this.drawText(node.text, entry.textLayout, entry.textBox, null, scale, [`${Math.round(value * 100)}%`]);
        }
    }
    private drawInput(node: GuiNode, entry: GuiLayoutEntry, scale: number): void {
        const control = node.control?.kind === 'input' ? node.control : null;
        if (!control || !node.text || !entry.textLayout || !entry.textBox)
            return;
        const value = this.value(node, control.value);
        const focused = this.options.state?.focused === node.id;
        const shown = control.password ? '•'.repeat(value.length) : value;
        const empty = shown.length === 0;
        const lines = empty ? [control.placeholder] : control.multiline ? shown.split('\n') : [shown];
        const style: GuiTextStyle = empty ? { ...node.text, color: control.placeholderColor, alpha: 0.9 } : node.text;
        this.drawText(style, entry.textLayout, entry.textBox, null, scale, lines);
        if (focused && Math.floor((this.options.state?.time ?? 0) * 2) % 2 === 0) {
            const { context } = this;
            const lastLine = empty ? '' : lines[lines.length - 1];
            context.font = entry.textLayout.font;
            const width = context.measureText(lastLine).width;
            const align = node.text.align;
            const box = entry.textBox;
            const totalHeight = lines.length * entry.textLayout.lineHeight;
            const startY = node.text.verticalAlign === 'top' ? box.y : node.text.verticalAlign === 'bottom' ? box.y + box.height - totalHeight : box.y + (box.height - totalHeight) / 2;
            const caretX = align === 'left' ? box.x + width : align === 'right' ? box.x + box.width : box.x + box.width / 2 + width / 2;
            const caretY = startY + (lines.length - 1) * entry.textLayout.lineHeight;
            context.fillStyle = control.caretColor;
            context.fillRect(caretX + 1, caretY + entry.textLayout.lineHeight * 0.12, Math.max(1, 1.5 * this.layout.offsetScale), entry.textLayout.lineHeight * 0.76);
        }
    }
    private drawDivider(node: GuiNode, box: GuiBox): void {
        const control = node.control?.kind === 'divider' ? node.control : null;
        if (!control)
            return;
        const { context } = this;
        const thickness = control.thickness * this.layout.offsetScale;
        context.strokeStyle = withAlpha(control.color, control.alpha);
        context.lineWidth = thickness;
        if (control.dashed)
            context.setLineDash([thickness * 4, thickness * 3]);
        context.beginPath();
        if (control.orientation === 'horizontal') {
            const y = box.y + box.height / 2;
            context.moveTo(box.x, y);
            context.lineTo(box.x + box.width, y);
        }
        else {
            const x = box.x + box.width / 2;
            context.moveTo(x, box.y);
            context.lineTo(x, box.y + box.height);
        }
        context.stroke();
        context.setLineDash([]);
    }
    private drawScrollbar(node: GuiNode, entry: GuiLayoutEntry, matrix: GuiMatrix): void {
        const control = node.control?.kind === 'scroll' ? node.control : null;
        if (!control || !entry.canvasSize || control.scrollbarThickness <= 0)
            return;
        const { context } = this;
        context.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
        const thickness = control.scrollbarThickness * this.layout.offsetScale;
        const scroll = this.options.state?.scroll.get(node.id) ?? { x: 0, y: 0 };
        const color = withAlpha(control.scrollbarColor, control.scrollbarAlpha);
        if (control.direction !== 'horizontal' && entry.canvasSize.y > entry.height + 0.5) {
            const track = entry.height - thickness * 2;
            const thumb = Math.max(thickness * 3, (entry.height / entry.canvasSize.y) * track);
            const y = thickness + (scroll.y / (entry.canvasSize.y - entry.height)) * (track - thumb);
            roundedRectPath(context, entry.width - thickness * 1.5, y, thickness, thumb, [thickness / 2, thickness / 2, thickness / 2, thickness / 2]);
            context.fillStyle = color;
            context.fill();
        }
        if (control.direction !== 'vertical' && entry.canvasSize.x > entry.width + 0.5) {
            const track = entry.width - thickness * 2;
            const thumb = Math.max(thickness * 3, (entry.width / entry.canvasSize.x) * track);
            const x = thickness + (scroll.x / (entry.canvasSize.x - entry.width)) * (track - thumb);
            roundedRectPath(context, x, entry.height - thickness * 1.5, thumb, thickness, [thickness / 2, thickness / 2, thickness / 2, thickness / 2]);
            context.fillStyle = color;
            context.fill();
        }
    }
    private drawImage(node: GuiNode, box: GuiBox, radii: GuiRadii): void {
        const image = node.image;
        if (!image)
            return;
        const { context } = this;
        const source = image.assetId ? this.options.images.get(image.assetId) : null;
        if (!source) {
            if (this.options.placeholders)
                this.drawImagePlaceholder(box, radii, image.assetId !== null && this.options.images.hasFailed(image.assetId));
            return;
        }
        context.save();
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        context.clip();
        context.globalAlpha *= image.tintAlpha;
        if (image.flipX || image.flipY) {
            context.translate(image.flipX ? box.x * 2 + box.width : 0, image.flipY ? box.y * 2 + box.height : 0);
            context.scale(image.flipX ? -1 : 1, image.flipY ? -1 : 1);
        }
        const tinted = image.tint !== '#ffffff' ? this.tint(source, image.tint) : source;
        context.imageSmoothingQuality = 'high';
        switch (image.fit) {
            case 'stretch':
                context.drawImage(tinted, box.x, box.y, box.width, box.height);
                break;
            case 'contain':
            case 'cover': {
                const ratio = image.fit === 'contain' ? Math.min(box.width / source.width, box.height / source.height) : Math.max(box.width / source.width, box.height / source.height);
                const width = source.width * ratio;
                const height = source.height * ratio;
                context.drawImage(tinted, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
                break;
            }
            case 'tile': {
                const pattern = context.createPattern(tinted, 'repeat');
                if (pattern) {
                    const matrix = new DOMMatrix().translate(box.x, box.y).scale(this.layout.offsetScale);
                    pattern.setTransform(matrix);
                    context.fillStyle = pattern;
                    context.fillRect(box.x, box.y, box.width, box.height);
                }
                break;
            }
            case 'slice':
                this.drawNineSlice(tinted, image.slice, box);
                break;
        }
        context.restore();
    }
    private drawNineSlice(source: GuiImageSource | HTMLCanvasElement, slice: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    }, box: GuiBox): void {
        const { context } = this;
        const sw = source.width;
        const sh = source.height;
        const left = Math.min(slice.left, sw / 2);
        const right = Math.min(slice.right, sw / 2);
        const top = Math.min(slice.top, sh / 2);
        const bottom = Math.min(slice.bottom, sh / 2);
        const s = this.layout.offsetScale;
        const dl = Math.min(left * s, box.width / 2);
        const dr = Math.min(right * s, box.width / 2);
        const dt = Math.min(top * s, box.height / 2);
        const db = Math.min(bottom * s, box.height / 2);
        const columns: Array<[
            number,
            number,
            number,
            number
        ]> = [
            [0, left, box.x, dl],
            [left, sw - left - right, box.x + dl, box.width - dl - dr],
            [sw - right, right, box.x + box.width - dr, dr],
        ];
        const rows: Array<[
            number,
            number,
            number,
            number
        ]> = [
            [0, top, box.y, dt],
            [top, sh - top - bottom, box.y + dt, box.height - dt - db],
            [sh - bottom, bottom, box.y + box.height - db, db],
        ];
        for (const [sy, sHeight, dy, dHeight] of rows) {
            for (const [sx, sWidth, dx, dWidth] of columns) {
                if (sWidth <= 0 || sHeight <= 0 || dWidth <= 0 || dHeight <= 0)
                    continue;
                context.drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            }
        }
    }
    private tint(source: GuiImageSource, color: string): HTMLCanvasElement {
        const scratch = this.scratch ?? document.createElement('canvas');
        this.scratch = scratch;
        scratch.width = source.width;
        scratch.height = source.height;
        const context = scratch.getContext('2d');
        if (!context)
            return scratch;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(source, 0, 0);
        context.globalCompositeOperation = 'multiply';
        context.fillStyle = color;
        context.fillRect(0, 0, scratch.width, scratch.height);
        context.globalCompositeOperation = 'destination-in';
        context.drawImage(source, 0, 0);
        context.globalCompositeOperation = 'source-over';
        return scratch;
    }
    private drawImagePlaceholder(box: GuiBox, radii: GuiRadii, failed: boolean): void {
        const { context } = this;
        context.save();
        roundedRectPath(context, box.x, box.y, box.width, box.height, radii);
        context.clip();
        context.fillStyle = failed ? 'rgba(255, 92, 108, 0.12)' : 'rgba(255, 255, 255, 0.06)';
        context.fillRect(box.x, box.y, box.width, box.height);
        context.strokeStyle = failed ? 'rgba(255, 92, 108, 0.5)' : 'rgba(255, 255, 255, 0.25)';
        context.lineWidth = 1;
        context.setLineDash([6, 4]);
        context.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(box.x, box.y);
        context.lineTo(box.x + box.width, box.y + box.height);
        context.moveTo(box.x + box.width, box.y);
        context.lineTo(box.x, box.y + box.height);
        context.stroke();
        context.restore();
    }
}
export function renderGuiLayout(context: CanvasRenderingContext2D, layout: GuiLayoutResult, options: GuiRenderOptions): void {
    new Renderer(context, layout, options).run();
}
