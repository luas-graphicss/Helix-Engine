import { createGuiDocument, createGuiId, createGuiNode, createGuiRoot, GUI_ELEMENT_KINDS, GUI_EXTENSION, GUI_FORMAT_ID, GUI_FORMAT_VERSION, GUI_MEDIA_BLENDS, GUI_MIME_TYPE, GUI_ROOT_ID, defaultIcon, defaultImage, defaultTextStyle, emptyStateStyle, type GuiAppearance, type GuiAutoLayout, type GuiControl, type GuiDocument, type GuiElementKind, type GuiGradient, type GuiIcon, type GuiImage, type GuiInsets, type GuiNode, type GuiPoint, type GuiRect, type GuiShadow, type GuiStates, type GuiStateStyle, type GuiStroke, type GuiTextStyle, type UDim, type UDim2, } from './gui-document';
interface GuiFileEnvelope {
    readonly format: typeof GUI_FORMAT_ID;
    readonly version: number;
    readonly document: GuiDocument;
}
export function guiDocumentToJson(document: GuiDocument): string {
    const envelope: GuiFileEnvelope = { format: GUI_FORMAT_ID, version: GUI_FORMAT_VERSION, document };
    return JSON.stringify(envelope, null, 2);
}
export function guiFileName(name: string): string {
    const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'tela';
    return `${safe}.${GUI_EXTENSION}`;
}
export function guiDocumentToFile(document: GuiDocument): File {
    return new File([guiDocumentToJson(document)], guiFileName(document.name), { type: GUI_MIME_TYPE });
}
type Raw = Record<string, unknown>;
function isRecord(value: unknown): value is Raw {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
    return Math.round(num(value, fallback, min, max));
}
function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}
function str(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export function isGuiColor(value: unknown): value is string {
    return typeof value === 'string' && HEX_COLOR.test(value);
}
function color(value: unknown, fallback: string): string {
    return isGuiColor(value) ? value.toLowerCase() : fallback;
}
function udim(value: unknown, fallback: UDim): UDim {
    if (!isRecord(value))
        return fallback;
    return { scale: num(value.scale, fallback.scale), offset: num(value.offset, fallback.offset) };
}
function udim2(value: unknown, fallback: UDim2): UDim2 {
    if (!isRecord(value))
        return fallback;
    return { x: udim(value.x, fallback.x), y: udim(value.y, fallback.y) };
}
function point(value: unknown, fallback: GuiPoint): GuiPoint {
    if (!isRecord(value))
        return fallback;
    return { x: num(value.x, fallback.x), y: num(value.y, fallback.y) };
}
function insets(value: unknown, fallback: GuiInsets): GuiInsets {
    if (!isRecord(value))
        return fallback;
    return { top: num(value.top, fallback.top), right: num(value.right, fallback.right), bottom: num(value.bottom, fallback.bottom), left: num(value.left, fallback.left) };
}
function gradient(value: unknown): GuiGradient | null {
    if (!isRecord(value) || !Array.isArray(value.stops))
        return null;
    const stops = value.stops.filter(isRecord).map((stop) => ({ offset: num(stop.offset, 0, 0, 1), color: color(stop.color, '#ffffff'), alpha: num(stop.alpha, 1, 0, 1) }));
    if (stops.length < 2)
        return null;
    return { kind: oneOf(value.kind, ['linear', 'radial'] as const, 'linear'), angle: num(value.angle, 90), stops };
}
function strokeOf(value: unknown, fallback: GuiStroke | null): GuiStroke | null {
    if (value === null)
        return null;
    if (!isRecord(value))
        return fallback;
    return { width: num(value.width, fallback?.width ?? 1, 0, 64), color: color(value.color, fallback?.color ?? '#ffffff'), alpha: num(value.alpha, fallback?.alpha ?? 1, 0, 1) };
}
function shadowOf(value: unknown, fallback: GuiShadow | null): GuiShadow | null {
    if (value === null)
        return null;
    if (!isRecord(value))
        return fallback;
    return {
        color: color(value.color, fallback?.color ?? '#000000'),
        alpha: num(value.alpha, fallback?.alpha ?? 0.35, 0, 1),
        blur: num(value.blur, fallback?.blur ?? 8, 0, 256),
        offsetX: num(value.offsetX, fallback?.offsetX ?? 0, -256, 256),
        offsetY: num(value.offsetY, fallback?.offsetY ?? 4, -256, 256),
    };
}
function appearance(value: unknown, fallback: GuiAppearance): GuiAppearance {
    if (!isRecord(value))
        return fallback;
    const fill = isRecord(value.fill) ? value.fill : {};
    const radii = Array.isArray(value.radii) && value.radii.length === 4 ? value.radii : null;
    return {
        fill: { color: color(fill.color, fallback.fill.color), alpha: num(fill.alpha, fallback.fill.alpha, 0, 1), gradient: gradient(fill.gradient) },
        stroke: strokeOf(value.stroke, fallback.stroke),
        radii: radii ? [num(radii[0], 0, 0, 1024), num(radii[1], 0, 0, 1024), num(radii[2], 0, 0, 1024), num(radii[3], 0, 0, 1024)] : fallback.radii,
        shadow: shadowOf(value.shadow, fallback.shadow),
        opacity: num(value.opacity, fallback.opacity, 0, 1),
    };
}
function rect(value: unknown, fallback: GuiRect): GuiRect {
    if (!isRecord(value))
        return fallback;
    return {
        position: udim2(value.position, fallback.position),
        size: udim2(value.size, fallback.size),
        anchor: point(value.anchor, fallback.anchor),
        rotation: num(value.rotation, fallback.rotation),
        zIndex: int(value.zIndex, fallback.zIndex, -1000, 1000),
        autoSize: oneOf(value.autoSize, ['none', 'x', 'y', 'xy'] as const, fallback.autoSize),
        aspectRatio: value.aspectRatio === null ? null : num(value.aspectRatio, fallback.aspectRatio ?? 1, 0.01, 100),
        minSize: point(value.minSize, fallback.minSize),
        maxSize: value.maxSize === null || value.maxSize === undefined ? fallback.maxSize : point(value.maxSize, fallback.maxSize ?? { x: 0, y: 0 }),
        ignoreLayout: bool(value.ignoreLayout, fallback.ignoreLayout),
        safeArea: bool(value.safeArea, fallback.safeArea),
    };
}
function layout(value: unknown, fallback: GuiAutoLayout): GuiAutoLayout {
    if (!isRecord(value))
        return fallback;
    return {
        kind: oneOf(value.kind, ['none', 'list', 'grid'] as const, fallback.kind),
        direction: oneOf(value.direction, ['horizontal', 'vertical'] as const, fallback.direction),
        gap: num(value.gap, fallback.gap, -512, 512),
        padding: insets(value.padding, fallback.padding),
        mainAlign: oneOf(value.mainAlign, ['start', 'center', 'end', 'space-between', 'space-around'] as const, fallback.mainAlign),
        crossAlign: oneOf(value.crossAlign, ['start', 'center', 'end', 'stretch'] as const, fallback.crossAlign),
        wrap: bool(value.wrap, fallback.wrap),
        cellSize: udim2(value.cellSize, fallback.cellSize),
        columns: value.columns === null ? null : int(value.columns, fallback.columns ?? 3, 1, 64),
    };
}
function textStyle(value: unknown, fallback: GuiTextStyle | null): GuiTextStyle | null {
    if (value === null)
        return null;
    if (!isRecord(value))
        return fallback;
    const base = fallback ?? defaultTextStyle('');
    return {
        content: str(value.content, base.content),
        family: str(value.family, base.family),
        size: num(value.size, base.size, 1, 1024),
        weight: int(value.weight, base.weight, 100, 900),
        italic: bool(value.italic, base.italic),
        color: color(value.color, base.color),
        alpha: num(value.alpha, base.alpha, 0, 1),
        align: oneOf(value.align, ['left', 'center', 'right'] as const, base.align),
        verticalAlign: oneOf(value.verticalAlign, ['top', 'middle', 'bottom'] as const, base.verticalAlign),
        lineHeight: num(value.lineHeight, base.lineHeight, 0.5, 4),
        letterSpacing: num(value.letterSpacing, base.letterSpacing, -20, 100),
        wrap: bool(value.wrap, base.wrap),
        uppercase: bool(value.uppercase, base.uppercase),
        shadow: shadowOf(value.shadow, base.shadow),
        outline: strokeOf(value.outline, base.outline),
        fitToBox: bool(value.fitToBox, base.fitToBox),
    };
}
function image(value: unknown, fallback: GuiImage | null): GuiImage | null {
    if (value === null)
        return null;
    if (!isRecord(value))
        return fallback;
    const base = fallback ?? defaultImage();
    return {
        assetId: typeof value.assetId === 'string' ? value.assetId : null,
        fit: oneOf(value.fit, ['stretch', 'contain', 'cover', 'tile', 'slice'] as const, base.fit),
        slice: insets(value.slice, base.slice),
        tint: color(value.tint, base.tint),
        tintAlpha: num(value.tintAlpha, base.tintAlpha, 0, 1),
        flipX: bool(value.flipX, base.flipX),
        flipY: bool(value.flipY, base.flipY),
    };
}
function icon(value: unknown, fallback: GuiIcon | null): GuiIcon | null {
    if (value === null)
        return null;
    if (!isRecord(value))
        return fallback;
    const base = fallback ?? defaultIcon();
    return { name: str(value.name, base.name), color: color(value.color, base.color), alpha: num(value.alpha, base.alpha, 0, 1), strokeWidth: num(value.strokeWidth, base.strokeWidth, 0.25, 6) };
}
function stateStyle(value: unknown, fallback: GuiStateStyle | null): GuiStateStyle | null {
    if (value === null)
        return null;
    if (!isRecord(value))
        return fallback;
    const base = fallback ?? emptyStateStyle();
    return {
        fillColor: value.fillColor === null ? null : isGuiColor(value.fillColor) ? value.fillColor.toLowerCase() : base.fillColor,
        fillAlpha: value.fillAlpha === null ? null : typeof value.fillAlpha === 'number' ? num(value.fillAlpha, 1, 0, 1) : base.fillAlpha,
        strokeColor: value.strokeColor === null ? null : isGuiColor(value.strokeColor) ? value.strokeColor.toLowerCase() : base.strokeColor,
        textColor: value.textColor === null ? null : isGuiColor(value.textColor) ? value.textColor.toLowerCase() : base.textColor,
        scale: num(value.scale, base.scale, 0.1, 4),
        opacity: value.opacity === null ? null : typeof value.opacity === 'number' ? num(value.opacity, 1, 0, 1) : base.opacity,
    };
}
function states(value: unknown, fallback: GuiStates): GuiStates {
    if (!isRecord(value))
        return fallback;
    return {
        hover: stateStyle(value.hover, fallback.hover),
        pressed: stateStyle(value.pressed, fallback.pressed),
        disabled: stateStyle(value.disabled, fallback.disabled),
        transitionMs: num(value.transitionMs, fallback.transitionMs, 0, 5000),
    };
}
