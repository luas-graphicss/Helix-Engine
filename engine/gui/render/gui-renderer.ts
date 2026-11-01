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
}
