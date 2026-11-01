import type { GuiInsets } from '@/engine/gui/document/gui-document';
export type GuiDeviceCategory = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'handheld' | 'tv' | 'custom';
export type GuiDevicePlatform = 'ios' | 'ipados' | 'android' | 'windows' | 'macos' | 'chromeos' | 'linux' | 'steamos' | 'nintendo' | 'playstation' | 'tvos' | 'smart-tv' | 'web';
export type GuiDeviceInput = 'pointer' | 'touch' | 'gamepad';
export type GuiDeviceOrientation = 'portrait' | 'landscape';
export type GuiDeviceCutoutKind = 'notch' | 'island' | 'punch-hole';
export interface GuiDeviceCutout {
    readonly kind: GuiDeviceCutoutKind;
    readonly width: number;
    readonly height: number;
    readonly top: number;
    readonly align: 'center' | 'left' | 'right';
    readonly edgeOffset?: number;
}
export interface GuiDeviceScreen {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly ppi: number | null;
    readonly diagonal: number;
    readonly cornerRadius: number;
}
export interface GuiDeviceSafeArea {
    readonly portrait: GuiInsets;
    readonly landscape: GuiInsets;
}
export interface GuiDeviceSpec {
    readonly id: string;
    readonly name: string;
    readonly brand: string;
    readonly category: GuiDeviceCategory;
    readonly platform: GuiDevicePlatform;
    readonly input: GuiDeviceInput;
    readonly year: number;
    readonly naturalOrientation: GuiDeviceOrientation;
    readonly screen: GuiDeviceScreen;
    readonly safeArea: GuiDeviceSafeArea;
    readonly cutout: GuiDeviceCutout | null;
    readonly homeIndicator: boolean;
    readonly statusBar: boolean;
}
export const GUI_DEVICE_CATEGORY_LABELS: Record<GuiDeviceCategory, string> = {
    phone: 'Celulares',
    tablet: 'Tablets',
    laptop: 'Notebooks',
    desktop: 'Monitores',
    handheld: 'Portáteis',
    tv: 'TVs e consoles',
    custom: 'Personalizado',
};
export const GUI_DEVICE_PLATFORM_LABELS: Record<GuiDevicePlatform, string> = {
    ios: 'iOS',
    ipados: 'iPadOS',
    android: 'Android',
    windows: 'Windows',
    macos: 'macOS',
    chromeos: 'ChromeOS',
    linux: 'Linux',
    steamos: 'SteamOS',
    nintendo: 'Nintendo',
    playstation: 'PlayStation',
    tvos: 'tvOS',
    'smart-tv': 'Smart TV',
    web: 'Web',
};
export const GUI_DEVICE_INPUT_LABELS: Record<GuiDeviceInput, string> = {
    pointer: 'Mouse e teclado',
    touch: 'Toque',
    gamepad: 'Controle',
};
export const GUI_DEVICE_ORIENTATION_LABELS: Record<GuiDeviceOrientation, string> = {
    portrait: 'Retrato',
    landscape: 'Paisagem',
};
export const GUI_NO_INSETS: GuiInsets = { top: 0, right: 0, bottom: 0, left: 0 };
export const GUI_NO_SAFE_AREA: GuiDeviceSafeArea = { portrait: GUI_NO_INSETS, landscape: GUI_NO_INSETS };
export interface GuiCustomDevice {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
}
export const GUI_CUSTOM_DEVICE_ID = 'custom';
export const GUI_CUSTOM_DEVICE_LIMITS = {
    minSize: 120,
    maxSize: 16384,
    minDpr: 0.5,
    maxDpr: 5,
} as const;
export function clampCustomDevice(custom: GuiCustomDevice): GuiCustomDevice {
    const { minSize, maxSize, minDpr, maxDpr } = GUI_CUSTOM_DEVICE_LIMITS;
    const clampSize = (value: number) => Math.round(Math.min(maxSize, Math.max(minSize, Number.isFinite(value) ? value : minSize)));
    const dpr = Number.isFinite(custom.dpr) ? Math.min(maxDpr, Math.max(minDpr, custom.dpr)) : 1;
    return { width: clampSize(custom.width), height: clampSize(custom.height), dpr: Math.round(dpr * 1000) / 1000 };
}
export function customDeviceSpec(custom: GuiCustomDevice): GuiDeviceSpec {
    const { width, height, dpr } = clampCustomDevice(custom);
    return {
        id: GUI_CUSTOM_DEVICE_ID,
        name: 'Personalizado',
        brand: '',
        category: 'custom',
        platform: 'web',
        input: 'pointer',
        year: 0,
        naturalOrientation: width >= height ? 'landscape' : 'portrait',
        screen: { width, height, dpr, ppi: null, diagonal: 0, cornerRadius: 0 },
        safeArea: GUI_NO_SAFE_AREA,
        cutout: null,
        homeIndicator: false,
        statusBar: false,
    };
}
export function orientationOf(width: number, height: number): GuiDeviceOrientation {
    return width >= height ? 'landscape' : 'portrait';
}
export function oppositeOrientation(orientation: GuiDeviceOrientation): GuiDeviceOrientation {
    return orientation === 'portrait' ? 'landscape' : 'portrait';
}
export function formatDpr(dpr: number): string {
    return `@${dpr.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}×`;
}
