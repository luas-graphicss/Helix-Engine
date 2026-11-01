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
function control(value: unknown, fallback: GuiControl | null): GuiControl | null {
    if (!fallback)
        return null;
    if (!isRecord(value))
        return fallback;
    switch (fallback.kind) {
        case 'button':
            return {
                kind: 'button',
                disabled: bool(value.disabled, fallback.disabled),
                iconName: typeof value.iconName === 'string' ? value.iconName : null,
                iconPosition: oneOf(value.iconPosition, ['left', 'right', 'top', 'only'] as const, fallback.iconPosition),
                iconSize: num(value.iconSize, fallback.iconSize, 4, 512),
                iconGap: num(value.iconGap, fallback.iconGap, 0, 256),
            };
        case 'toggle':
            return {
                kind: 'toggle',
                value: bool(value.value, fallback.value),
                style: oneOf(value.style, ['switch', 'checkbox'] as const, fallback.style),
                onColor: color(value.onColor, fallback.onColor),
                knobColor: color(value.knobColor, fallback.knobColor),
            };
        case 'slider': {
            const min = num(value.min, fallback.min);
            const max = Math.max(min, num(value.max, fallback.max));
            return {
                kind: 'slider',
                min,
                max,
                value: num(value.value, fallback.value, min, max),
                step: num(value.step, fallback.step, 0, Math.max(1, max - min)),
                direction: oneOf(value.direction, ['horizontal', 'vertical'] as const, fallback.direction),
                trackColor: color(value.trackColor, fallback.trackColor),
                trackAlpha: num(value.trackAlpha, fallback.trackAlpha, 0, 1),
                fillColor: color(value.fillColor, fallback.fillColor),
                knobColor: color(value.knobColor, fallback.knobColor),
                knobSize: num(value.knobSize, fallback.knobSize, 2, 256),
                trackThickness: num(value.trackThickness, fallback.trackThickness, 1, 256),
            };
        }
        case 'progress':
            return {
                kind: 'progress',
                value: num(value.value, fallback.value, 0, 1),
                direction: oneOf(value.direction, ['horizontal', 'vertical'] as const, fallback.direction),
                reverse: bool(value.reverse, fallback.reverse),
                fillColor: color(value.fillColor, fallback.fillColor),
                fillAlpha: num(value.fillAlpha, fallback.fillAlpha, 0, 1),
                fillGradient: gradient(value.fillGradient),
                showLabel: bool(value.showLabel, fallback.showLabel),
                segments: int(value.segments, fallback.segments, 0, 64),
            };
        case 'input':
            return {
                kind: 'input',
                value: str(value.value, fallback.value),
                placeholder: str(value.placeholder, fallback.placeholder),
                placeholderColor: color(value.placeholderColor, fallback.placeholderColor),
                maxLength: value.maxLength === null ? null : int(value.maxLength, fallback.maxLength ?? 64, 1, 100000),
                password: bool(value.password, fallback.password),
                multiline: bool(value.multiline, fallback.multiline),
                caretColor: color(value.caretColor, fallback.caretColor),
            };
        case 'scroll':
            return {
                kind: 'scroll',
                canvasSize: udim2(value.canvasSize, fallback.canvasSize),
                direction: oneOf(value.direction, ['horizontal', 'vertical', 'both'] as const, fallback.direction),
                scrollbarThickness: num(value.scrollbarThickness, fallback.scrollbarThickness, 0, 64),
                scrollbarColor: color(value.scrollbarColor, fallback.scrollbarColor),
                scrollbarAlpha: num(value.scrollbarAlpha, fallback.scrollbarAlpha, 0, 1),
            };
        case 'divider':
            return {
                kind: 'divider',
                orientation: oneOf(value.orientation, ['horizontal', 'vertical'] as const, fallback.orientation),
                thickness: num(value.thickness, fallback.thickness, 0.5, 64),
                color: color(value.color, fallback.color),
                alpha: num(value.alpha, fallback.alpha, 0, 1),
                dashed: bool(value.dashed, fallback.dashed),
            };
        case 'video': {
            const startTime = num(value.startTime, fallback.startTime, 0, 86400);
            return {
                kind: 'video',
                assetId: typeof value.assetId === 'string' ? value.assetId : null,
                fit: oneOf(value.fit, ['cover', 'contain', 'stretch'] as const, fallback.fit),
                playOn: oneOf(value.playOn, ['start', 'hover', 'manual'] as const, fallback.playOn),
                loop: bool(value.loop, fallback.loop),
                muted: bool(value.muted, fallback.muted),
                volume: num(value.volume, fallback.volume, 0, 1),
                speed: num(value.speed, fallback.speed, 0.1, 4),
                startTime,
                endTime: value.endTime === null || value.endTime === undefined ? null : num(value.endTime, startTime + 1, startTime, 86400),
                clickToggles: bool(value.clickToggles, fallback.clickToggles),
                restartOnPlay: bool(value.restartOnPlay, fallback.restartOnPlay),
                showControls: bool(value.showControls, fallback.showControls),
                blend: oneOf(value.blend, GUI_MEDIA_BLENDS, fallback.blend),
                tint: color(value.tint, fallback.tint),
                tintAlpha: num(value.tintAlpha, fallback.tintAlpha, 0, 1),
                flipX: bool(value.flipX, fallback.flipX),
                flipY: bool(value.flipY, fallback.flipY),
                posterAssetId: typeof value.posterAssetId === 'string' ? value.posterAssetId : null,
            };
        }
        case 'viewport': {
            const minDistance = num(value.minDistance, fallback.minDistance, 0.05, 1000);
            return {
                kind: 'viewport',
                camera: oneOf(value.camera, ['entity', 'orbit'] as const, fallback.camera),
                cameraName: str(value.cameraName, fallback.cameraName).slice(0, 120),
                targetName: str(value.targetName, fallback.targetName).slice(0, 120),
                distance: num(value.distance, fallback.distance, 0.05, 1000),
                yaw: num(value.yaw, fallback.yaw, -360, 360),
                pitch: num(value.pitch, fallback.pitch, -89, 89),
                autoRotate: num(value.autoRotate, fallback.autoRotate, -360, 360),
                fov: num(value.fov, fallback.fov, 5, 150),
                interactive: bool(value.interactive, fallback.interactive),
                minDistance,
                maxDistance: num(value.maxDistance, fallback.maxDistance, minDistance, 1000),
                resolutionScale: num(value.resolutionScale, fallback.resolutionScale, 0.25, 1),
                frameRate: num(value.frameRate, fallback.frameRate, 0, 120),
                grid: bool(value.grid, fallback.grid),
                blend: oneOf(value.blend, GUI_MEDIA_BLENDS, fallback.blend),
                tint: color(value.tint, fallback.tint),
                tintAlpha: num(value.tintAlpha, fallback.tintAlpha, 0, 1),
            };
        }
    }
}
function normalizeNode(value: unknown, seen: Set<string>, isRoot: boolean): GuiNode | null {
    if (!isRecord(value))
        return null;
    const kind: GuiElementKind = isRoot ? 'frame' : oneOf(value.kind, GUI_ELEMENT_KINDS, 'frame');
    const base = isRoot ? createGuiRoot() : createGuiNode(kind);
    let id = isRoot ? GUI_ROOT_ID : str(value.id, '');
    if (!id || seen.has(id))
        id = createGuiId();
    seen.add(id);
    const children = Array.isArray(value.children) ? value.children.map((child) => normalizeNode(child, seen, false)).filter((child): child is GuiNode => child !== null) : [];
    return {
        id,
        name: str(value.name, base.name).slice(0, 120) || base.name,
        kind,
        visible: bool(value.visible, base.visible),
        locked: bool(value.locked, base.locked),
        interactable: bool(value.interactable, base.interactable),
        clipsContent: bool(value.clipsContent, base.clipsContent),
        rect: rect(value.rect, base.rect),
        appearance: appearance(value.appearance, base.appearance),
        layout: layout(value.layout, base.layout),
        text: textStyle(value.text, base.text),
        image: image(value.image, base.image),
        icon: icon(value.icon, base.icon),
        control: control(value.control, base.control),
        states: states(value.states, base.states),
        children,
    };
}
export function normalizeGuiDocument(raw: unknown): GuiDocument {
    if (!isRecord(raw))
        throw new Error('O arquivo não contém um documento de interface.');
    const base = createGuiDocument();
    const root = normalizeNode(raw.root, new Set(), true) ?? base.root;
    return {
        name: str(raw.name, base.name).trim().slice(0, 120) || base.name,
        referenceSize: { x: num(isRecord(raw.referenceSize) ? raw.referenceSize.x : undefined, base.referenceSize.x, 64, 16384), y: num(isRecord(raw.referenceSize) ? raw.referenceSize.y : undefined, base.referenceSize.y, 64, 16384) },
        scaleMode: oneOf(raw.scaleMode, ['none', 'width', 'height', 'shorter', 'longer'] as const, base.scaleMode),
        enabled: bool(raw.enabled, base.enabled),
        displayOrder: int(raw.displayOrder, base.displayOrder, -1000, 1000),
        root,
        createdAt: num(raw.createdAt, base.createdAt),
    };
}
export function parseGuiDocument(text: string): GuiDocument {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error('O arquivo não é um JSON válido.');
    }
    if (!isRecord(parsed))
        throw new Error('O arquivo não contém um documento de interface.');
    if (parsed.format !== GUI_FORMAT_ID)
        throw new Error(`Formato desconhecido: esperado "${GUI_FORMAT_ID}".`);
    if (typeof parsed.version === 'number' && parsed.version > GUI_FORMAT_VERSION)
        throw new Error(`Versão ${parsed.version} do formato é mais nova que a suportada (${GUI_FORMAT_VERSION}).`);
    return normalizeGuiDocument(parsed.document);
}
export async function readGuiDocument(file: File): Promise<GuiDocument> {
    return parseGuiDocument(await file.text());
}
