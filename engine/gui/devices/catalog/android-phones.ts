import type { GuiDeviceCutout, GuiDeviceSpec } from '../device-model';
const GESTURE_BAR = 24;
const STATUS_MARGIN = 10;
interface AndroidProfile {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly ppi: number;
    readonly diagonal: number;
    readonly cornerRadius: number;
    readonly cutout: GuiDeviceCutout | null;
}
function hole(size: number, top = 12, align: GuiDeviceCutout['align'] = 'center'): GuiDeviceCutout {
    return { kind: 'punch-hole', width: size, height: size, top, align, edgeOffset: align === 'center' ? undefined : 28 };
}
function android(id: string, name: string, brand: string, year: number, profile: AndroidProfile): GuiDeviceSpec {
    const { width, height, dpr, ppi, diagonal, cornerRadius, cutout } = profile;
    const statusBar = cutout ? cutout.top + cutout.height + STATUS_MARGIN : 24;
    return {
        id,
        name,
        brand,
        category: 'phone',
        platform: 'android',
        input: 'touch',
        year,
        naturalOrientation: 'portrait',
        screen: { width, height, dpr, ppi, diagonal, cornerRadius },
        safeArea: {
            portrait: { top: statusBar, right: 0, bottom: GESTURE_BAR, left: 0 },
            landscape: { top: 0, right: 0, bottom: GESTURE_BAR, left: cutout ? statusBar : 0 },
        },
        cutout,
        homeIndicator: true,
        statusBar: true,
    };
}
const PIXEL_6_1: AndroidProfile = { width: 412, height: 915, dpr: 2.625, ppi: 429, diagonal: 6.1, cornerRadius: 36, cutout: hole(26) };
const PIXEL_6_3: AndroidProfile = { width: 412, height: 923, dpr: 2.625, ppi: 422, diagonal: 6.3, cornerRadius: 36, cutout: hole(26) };
const PIXEL_PRO_6_3: AndroidProfile = { width: 427, height: 952, dpr: 3, ppi: 495, diagonal: 6.3, cornerRadius: 36, cutout: hole(24) };
const PIXEL_PRO_XL: AndroidProfile = { width: 448, height: 997, dpr: 3, ppi: 486, diagonal: 6.8, cornerRadius: 40, cutout: hole(24) };
const GALAXY_S_BASE: AndroidProfile = { width: 360, height: 780, dpr: 3, ppi: 416, diagonal: 6.2, cornerRadius: 28, cutout: hole(22, 10) };
const GALAXY_S_ULTRA: AndroidProfile = { width: 412, height: 891, dpr: 3.5, ppi: 505, diagonal: 6.8, cornerRadius: 12, cutout: hole(22, 10) };
export const ANDROID_PHONES: readonly GuiDeviceSpec[] = [
    android('pixel-10-pro-xl', 'Pixel 10 Pro XL', 'Google', 2025, PIXEL_PRO_XL),
    android('pixel-10-pro', 'Pixel 10 Pro', 'Google', 2025, PIXEL_PRO_6_3),
    android('pixel-10', 'Pixel 10', 'Google', 2025, PIXEL_6_3),
    android('pixel-9a', 'Pixel 9a', 'Google', 2025, { ...PIXEL_6_3, ppi: 422 }),
    android('pixel-9-pro-xl', 'Pixel 9 Pro XL', 'Google', 2024, PIXEL_PRO_XL),
    android('pixel-9-pro', 'Pixel 9 Pro', 'Google', 2024, PIXEL_PRO_6_3),
    android('pixel-9', 'Pixel 9', 'Google', 2024, PIXEL_6_3),
    android('pixel-8a', 'Pixel 8a', 'Google', 2024, { ...PIXEL_6_1, ppi: 430 }),
    android('pixel-8-pro', 'Pixel 8 Pro', 'Google', 2023, { width: 448, height: 998, dpr: 3, ppi: 489, diagonal: 6.7, cornerRadius: 40, cutout: hole(24) }),
    android('pixel-8', 'Pixel 8', 'Google', 2023, { ...PIXEL_6_1, height: 915, ppi: 428, diagonal: 6.2 }),
    android('pixel-7a', 'Pixel 7a', 'Google', 2023, PIXEL_6_1),
    android('pixel-7-pro', 'Pixel 7 Pro', 'Google', 2022, { width: 412, height: 892, dpr: 3.5, ppi: 512, diagonal: 6.7, cornerRadius: 40, cutout: hole(24) }),
    android('pixel-7', 'Pixel 7', 'Google', 2022, { ...PIXEL_6_1, ppi: 416, diagonal: 6.3 }),
    android('galaxy-s25-ultra', 'Galaxy S25 Ultra', 'Samsung', 2025, { ...GALAXY_S_ULTRA, ppi: 498, diagonal: 6.9, cornerRadius: 16 }),
    android('galaxy-s25', 'Galaxy S25', 'Samsung', 2025, GALAXY_S_BASE),
    android('galaxy-s24-ultra', 'Galaxy S24 Ultra', 'Samsung', 2024, GALAXY_S_ULTRA),
    android('galaxy-s24', 'Galaxy S24', 'Samsung', 2024, GALAXY_S_BASE),
    android('galaxy-s23-ultra', 'Galaxy S23 Ultra', 'Samsung', 2023, { ...GALAXY_S_ULTRA, height: 883, ppi: 500 }),
    android('galaxy-s23', 'Galaxy S23', 'Samsung', 2023, { ...GALAXY_S_BASE, ppi: 425, diagonal: 6.1 }),
    android('galaxy-a55', 'Galaxy A55', 'Samsung', 2024, { width: 393, height: 851, dpr: 2.75, ppi: 390, diagonal: 6.6, cornerRadius: 24, cutout: hole(22, 10) }),
    android('galaxy-z-flip-6', 'Galaxy Z Flip6', 'Samsung', 2024, { width: 411, height: 1006, dpr: 2.625, ppi: 425, diagonal: 6.7, cornerRadius: 28, cutout: hole(22, 10) }),
    android('galaxy-z-fold-6', 'Galaxy Z Fold6 (aberto)', 'Samsung', 2024, { width: 742, height: 864, dpr: 2.5, ppi: 374, diagonal: 7.6, cornerRadius: 24, cutout: null }),
    android('xiaomi-15', 'Xiaomi 15', 'Xiaomi', 2025, { width: 400, height: 890, dpr: 3, ppi: 460, diagonal: 6.36, cornerRadius: 32, cutout: hole(22) }),
    android('xiaomi-14', 'Xiaomi 14', 'Xiaomi', 2024, { width: 400, height: 890, dpr: 3, ppi: 460, diagonal: 6.36, cornerRadius: 32, cutout: hole(22) }),
    android('redmi-note-13', 'Redmi Note 13', 'Xiaomi', 2024, { width: 393, height: 873, dpr: 2.75, ppi: 395, diagonal: 6.67, cornerRadius: 28, cutout: hole(22) }),
    android('oneplus-13', 'OnePlus 13', 'OnePlus', 2025, { width: 412, height: 919, dpr: 3.5, ppi: 510, diagonal: 6.82, cornerRadius: 36, cutout: hole(22, 12, 'left') }),
    android('oneplus-12', 'OnePlus 12', 'OnePlus', 2024, { width: 411, height: 905, dpr: 3.5, ppi: 510, diagonal: 6.82, cornerRadius: 36, cutout: hole(22, 12, 'left') }),
    android('moto-edge-50', 'Motorola Edge 50', 'Motorola', 2024, { width: 393, height: 873, dpr: 2.75, ppi: 393, diagonal: 6.7, cornerRadius: 32, cutout: hole(22) }),
    android('moto-g-power', 'Moto G Power (2024)', 'Motorola', 2024, { width: 412, height: 915, dpr: 2.625, ppi: 399, diagonal: 6.7, cornerRadius: 28, cutout: hole(24) }),
];
