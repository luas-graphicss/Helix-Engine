import type { GuiDeviceSpec } from '../device-model';
interface AndroidTabletProfile {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly ppi: number;
    readonly diagonal: number;
}
const TABLET_INSETS = { top: 24, right: 0, bottom: 24, left: 0 };
function tablet(id: string, name: string, brand: string, year: number, profile: AndroidTabletProfile): GuiDeviceSpec {
    const { width, height, dpr, ppi, diagonal } = profile;
    return {
        id,
        name,
        brand,
        category: 'tablet',
        platform: 'android',
        input: 'touch',
        year,
        naturalOrientation: 'landscape',
        screen: { width, height, dpr, ppi, diagonal, cornerRadius: 16 },
        safeArea: { portrait: TABLET_INSETS, landscape: TABLET_INSETS },
        cutout: null,
        homeIndicator: true,
        statusBar: true,
    };
}
export const ANDROID_TABLETS: readonly GuiDeviceSpec[] = [
    tablet('galaxy-tab-s10-ultra', 'Galaxy Tab S10 Ultra', 'Samsung', 2024, { width: 1480, height: 924, dpr: 2, ppi: 239, diagonal: 14.6 }),
    tablet('galaxy-tab-s10-plus', 'Galaxy Tab S10+', 'Samsung', 2024, { width: 1400, height: 876, dpr: 2, ppi: 266, diagonal: 12.4 }),
    tablet('galaxy-tab-s9', 'Galaxy Tab S9', 'Samsung', 2023, { width: 1280, height: 800, dpr: 2, ppi: 274, diagonal: 11 }),
    tablet('galaxy-tab-a9-plus', 'Galaxy Tab A9+', 'Samsung', 2023, { width: 1200, height: 750, dpr: 1.6, ppi: 206, diagonal: 11 }),
    tablet('lenovo-tab-p12', 'Lenovo Tab P12', 'Lenovo', 2023, { width: 1472, height: 920, dpr: 2, ppi: 273, diagonal: 12.7 }),
    tablet('fire-hd-10', 'Fire HD 10', 'Amazon', 2023, { width: 1280, height: 800, dpr: 1.5, ppi: 224, diagonal: 10.1 }),
];
