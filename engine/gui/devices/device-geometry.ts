import type { GuiInsets, GuiPoint } from '@/engine/gui/document/gui-document';
import { GUI_NO_INSETS, orientationOf, type GuiDeviceCutoutKind, type GuiDeviceOrientation, type GuiDeviceSpec } from './device-model';
export interface GuiDeviceRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface GuiEmulatedCutout extends GuiDeviceRect {
    readonly kind: GuiDeviceCutoutKind;
}
export type GuiDeviceFrameStyle = 'phone' | 'tablet' | 'laptop' | 'monitor' | 'tv' | 'handheld';
export interface GuiEmulatedFrame {
    readonly style: GuiDeviceFrameStyle;
    readonly bezel: GuiInsets;
    readonly radius: number;
    readonly stand: number;
}
export interface GuiEmulatedScreen {
    readonly spec: GuiDeviceSpec | null;
    readonly orientation: GuiDeviceOrientation;
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly physical: GuiPoint;
    readonly safeArea: GuiInsets;
    readonly cutouts: readonly GuiEmulatedCutout[];
    readonly cornerRadius: number;
    readonly homeIndicator: GuiDeviceRect | null;
    readonly statusBarHeight: number;
    readonly frame: GuiEmulatedFrame | null;
}
const GENERIC_SAFE_FRACTION = 0.05;
const CSS_PIXELS_PER_INCH = 96;
function uniformInsets(value: number): GuiInsets {
    return { top: value, right: value, bottom: value, left: value };
}
function rotateRect(rect: GuiDeviceRect, from: GuiPoint, direction: 'ccw' | 'cw'): GuiDeviceRect {
    if (direction === 'ccw')
        return { x: rect.y, y: from.x - rect.x - rect.width, width: rect.height, height: rect.width };
    return { x: from.y - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width };
}
function cutoutRect(spec: GuiDeviceSpec): GuiDeviceRect | null {
    const cutout = spec.cutout;
    if (!cutout)
        return null;
    const edge = cutout.edgeOffset ?? 24;
    const x = cutout.align === 'center' ? (spec.screen.width - cutout.width) / 2 : cutout.align === 'left' ? edge : spec.screen.width - edge - cutout.width;
    return { x, y: cutout.top, width: cutout.width, height: cutout.height };
}
function homeIndicatorRect(width: number, height: number, orientation: GuiDeviceOrientation): GuiDeviceRect {
    const indicatorWidth = Math.round(orientation === 'portrait' ? width * 0.345 : width * 0.25);
    const indicatorHeight = 5;
    return { x: (width - indicatorWidth) / 2, y: height - 8 - indicatorHeight, width: indicatorWidth, height: indicatorHeight };
}
function frameFor(spec: GuiDeviceSpec, width: number, height: number): GuiEmulatedFrame | null {
    const short = Math.min(width, height);
    switch (spec.category) {
        case 'phone': {
            const bezel = Math.round(short * 0.035);
            return { style: 'phone', bezel: uniformInsets(bezel), radius: spec.screen.cornerRadius + bezel, stand: 0 };
        }
        case 'tablet': {
            const bezel = Math.round(short * 0.05);
            return { style: 'tablet', bezel: uniformInsets(bezel), radius: spec.screen.cornerRadius + bezel, stand: 0 };
        }
        case 'laptop': {
            const bezel = Math.round(short * 0.03);
            return { style: 'laptop', bezel: { top: bezel, right: bezel, bottom: Math.round(short * 0.07), left: bezel }, radius: Math.round(short * 0.02), stand: Math.round(short * 0.035) };
        }
        case 'desktop': {
            const bezel = Math.round(short * 0.025);
            return { style: 'monitor', bezel: { top: bezel, right: bezel, bottom: Math.round(short * 0.045), left: bezel }, radius: Math.round(short * 0.01), stand: Math.round(short * 0.16) };
        }
        case 'tv': {
            const bezel = Math.round(short * 0.012);
            return { style: 'tv', bezel: uniformInsets(bezel), radius: Math.round(short * 0.006), stand: 0 };
        }
        case 'handheld': {
            const grip = Math.round(width * 0.24);
            const bezel = Math.round(short * 0.07);
            return { style: 'handheld', bezel: { top: bezel, right: grip, bottom: bezel, left: grip }, radius: Math.round(short * 0.08), stand: 0 };
        }
        case 'custom':
            return null;
    }
}
export function emulatedDeviceBounds(screen: GuiEmulatedScreen, withFrame: boolean): GuiDeviceRect {
    const frame = withFrame ? screen.frame : null;
    if (!frame)
        return { x: 0, y: 0, width: screen.width, height: screen.height };
    const { bezel } = frame;
    return { x: -bezel.left, y: -bezel.top, width: screen.width + bezel.left + bezel.right, height: screen.height + bezel.top + bezel.bottom + frame.stand };
}
function referenceScreen(reference: GuiPoint, orientation: GuiDeviceOrientation): GuiEmulatedScreen {
    const swap = orientationOf(reference.x, reference.y) !== orientation;
    const width = swap ? reference.y : reference.x;
    const height = swap ? reference.x : reference.y;
    return {
        spec: null,
        orientation,
        width,
        height,
        dpr: 1,
        physical: { x: width, y: height },
        safeArea: { top: Math.round(height * GENERIC_SAFE_FRACTION), right: Math.round(width * GENERIC_SAFE_FRACTION), bottom: Math.round(height * GENERIC_SAFE_FRACTION), left: Math.round(width * GENERIC_SAFE_FRACTION) },
        cutouts: [],
        cornerRadius: 0,
        homeIndicator: null,
        statusBarHeight: 0,
        frame: null,
    };
}
export function resolveEmulatedScreen(spec: GuiDeviceSpec | null, orientation: GuiDeviceOrientation, reference: GuiPoint): GuiEmulatedScreen {
    if (!spec)
        return referenceScreen(reference, orientation);
    const natural: GuiPoint = { x: spec.screen.width, y: spec.screen.height };
    const rotated = spec.naturalOrientation !== orientation;
    const width = rotated ? natural.y : natural.x;
    const height = rotated ? natural.x : natural.y;
    const direction = spec.naturalOrientation === 'portrait' ? 'ccw' : 'cw';
    const cutout = cutoutRect(spec);
    const cutouts: GuiEmulatedCutout[] = cutout && spec.cutout ? [{ kind: spec.cutout.kind, ...(rotated ? rotateRect(cutout, natural, direction) : cutout) }] : [];
    const safeArea = orientation === 'portrait' ? spec.safeArea.portrait : spec.safeArea.landscape;
    return {
        spec,
        orientation,
        width,
        height,
        dpr: spec.screen.dpr,
        physical: { x: Math.round(width * spec.screen.dpr), y: Math.round(height * spec.screen.dpr) },
        safeArea: safeArea ?? GUI_NO_INSETS,
        cutouts,
        cornerRadius: spec.screen.cornerRadius,
        homeIndicator: spec.homeIndicator ? homeIndicatorRect(width, height, orientation) : null,
        statusBarHeight: spec.statusBar && orientation === 'portrait' ? safeArea.top : 0,
        frame: frameFor(spec, width, height),
    };
}
export function zoomForDevicePixels(screen: GuiEmulatedScreen, editorDpr: number): number {
    return screen.dpr / Math.max(editorDpr, 0.01);
}
export function zoomForPhysicalSize(screen: GuiEmulatedScreen): number | null {
    const ppi = screen.spec?.screen.ppi;
    return ppi ? (screen.dpr / ppi) * CSS_PIXELS_PER_INCH : null;
}
export function physicalSizeCm(screen: GuiEmulatedScreen): GuiPoint | null {
    const ppi = screen.spec?.screen.ppi;
    if (!ppi)
        return null;
    return { x: (screen.physical.x / ppi) * 2.54, y: (screen.physical.y / ppi) * 2.54 };
}
