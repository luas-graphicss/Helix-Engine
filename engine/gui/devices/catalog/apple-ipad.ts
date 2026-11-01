import type { GuiDeviceSpec } from '../device-model';
interface IpadProfile {
    readonly width: number;
    readonly height: number;
    readonly ppi: number;
    readonly diagonal: number;
    readonly homeButton?: boolean;
}
function ipad(id: string, name: string, year: number, profile: IpadProfile): GuiDeviceSpec {
    const { width, height, ppi, diagonal, homeButton = false } = profile;
    const insets = homeButton ? { top: 20, right: 0, bottom: 0, left: 0 } : { top: 24, right: 0, bottom: 20, left: 0 };
    return {
        id,
        name,
        brand: 'Apple',
        category: 'tablet',
        platform: 'ipados',
        input: 'touch',
        year,
        naturalOrientation: 'portrait',
        screen: { width, height, dpr: 2, ppi, diagonal, cornerRadius: homeButton ? 0 : 18 },
        safeArea: { portrait: insets, landscape: insets },
        cutout: null,
        homeIndicator: !homeButton,
        statusBar: true,
    };
}
export const APPLE_IPADS: readonly GuiDeviceSpec[] = [
    ipad('ipad-pro-13-m4', 'iPad Pro 13" (M4)', 2024, { width: 1032, height: 1376, ppi: 264, diagonal: 13 }),
    ipad('ipad-pro-11-m4', 'iPad Pro 11" (M4)', 2024, { width: 834, height: 1210, ppi: 264, diagonal: 11.1 }),
    ipad('ipad-air-13', 'iPad Air 13" (M2/M3)', 2024, { width: 1024, height: 1366, ppi: 264, diagonal: 13 }),
    ipad('ipad-air-11', 'iPad Air 11" (M2/M3)', 2024, { width: 820, height: 1180, ppi: 264, diagonal: 11 }),
    ipad('ipad-a16', 'iPad (A16)', 2025, { width: 820, height: 1180, ppi: 264, diagonal: 11 }),
    ipad('ipad-mini-a17', 'iPad mini (A17 Pro)', 2024, { width: 744, height: 1133, ppi: 326, diagonal: 8.3 }),
    ipad('ipad-pro-12-9-m2', 'iPad Pro 12,9" (M2)', 2022, { width: 1024, height: 1366, ppi: 264, diagonal: 12.9 }),
    ipad('ipad-10', 'iPad (10ª geração)', 2022, { width: 820, height: 1180, ppi: 264, diagonal: 10.9 }),
    ipad('ipad-mini-6', 'iPad mini (6ª geração)', 2021, { width: 744, height: 1133, ppi: 326, diagonal: 8.3 }),
    ipad('ipad-9', 'iPad (9ª geração)', 2021, { width: 810, height: 1080, ppi: 264, diagonal: 10.2, homeButton: true }),
];
