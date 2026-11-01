import type { GuiDeviceCutout, GuiDeviceSpec } from '../device-model';
interface IphoneProfile {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly ppi: number;
    readonly diagonal: number;
    readonly cornerRadius: number;
    readonly cutout: GuiDeviceCutout | null;
    readonly top: number;
    readonly bottom: number;
}
const NOTCH_WIDE: GuiDeviceCutout = { kind: 'notch', width: 211, height: 32, top: 0, align: 'center' };
const NOTCH_X: GuiDeviceCutout = { kind: 'notch', width: 209, height: 30, top: 0, align: 'center' };
const NOTCH_NARROW: GuiDeviceCutout = { kind: 'notch', width: 162, height: 32, top: 0, align: 'center' };
const ISLAND: GuiDeviceCutout = { kind: 'island', width: 126, height: 37, top: 11, align: 'center' };
const ISLAND_LOW: GuiDeviceCutout = { kind: 'island', width: 126, height: 37, top: 14, align: 'center' };
const SE: IphoneProfile = { width: 375, height: 667, dpr: 2, ppi: 326, diagonal: 4.7, cornerRadius: 0, cutout: null, top: 20, bottom: 0 };
const XR_11: IphoneProfile = { width: 414, height: 896, dpr: 2, ppi: 326, diagonal: 6.1, cornerRadius: 41, cutout: NOTCH_X, top: 48, bottom: 34 };
const X_11_PRO: IphoneProfile = { width: 375, height: 812, dpr: 3, ppi: 458, diagonal: 5.8, cornerRadius: 39, cutout: NOTCH_X, top: 44, bottom: 34 };
const XS_MAX_11_PRO_MAX: IphoneProfile = { width: 414, height: 896, dpr: 3, ppi: 458, diagonal: 6.5, cornerRadius: 39, cutout: NOTCH_X, top: 44, bottom: 34 };
const MINI_12: IphoneProfile = { width: 375, height: 812, dpr: 3, ppi: 476, diagonal: 5.4, cornerRadius: 44, cutout: NOTCH_WIDE, top: 50, bottom: 34 };
const MINI_13: IphoneProfile = { ...MINI_12, cutout: NOTCH_NARROW };
const STD_12: IphoneProfile = { width: 390, height: 844, dpr: 3, ppi: 460, diagonal: 6.1, cornerRadius: 47, cutout: NOTCH_WIDE, top: 47, bottom: 34 };
const STD_13: IphoneProfile = { ...STD_12, cutout: NOTCH_NARROW };
const MAX_12: IphoneProfile = { width: 428, height: 926, dpr: 3, ppi: 458, diagonal: 6.7, cornerRadius: 53, cutout: NOTCH_WIDE, top: 47, bottom: 34 };
const MAX_13: IphoneProfile = { ...MAX_12, cutout: NOTCH_NARROW };
const ISLAND_61: IphoneProfile = { width: 393, height: 852, dpr: 3, ppi: 460, diagonal: 6.1, cornerRadius: 55, cutout: ISLAND, top: 59, bottom: 34 };
const ISLAND_67: IphoneProfile = { width: 430, height: 932, dpr: 3, ppi: 460, diagonal: 6.7, cornerRadius: 55, cutout: ISLAND, top: 59, bottom: 34 };
const ISLAND_63: IphoneProfile = { width: 402, height: 874, dpr: 3, ppi: 460, diagonal: 6.3, cornerRadius: 62, cutout: ISLAND_LOW, top: 62, bottom: 34 };
const ISLAND_69: IphoneProfile = { width: 440, height: 956, dpr: 3, ppi: 460, diagonal: 6.9, cornerRadius: 62, cutout: ISLAND_LOW, top: 62, bottom: 34 };
const AIR_65: IphoneProfile = { width: 420, height: 912, dpr: 3, ppi: 460, diagonal: 6.5, cornerRadius: 62, cutout: ISLAND_LOW, top: 62, bottom: 34 };
function iphone(id: string, name: string, year: number, profile: IphoneProfile): GuiDeviceSpec {
    const { width, height, dpr, ppi, diagonal, cornerRadius, cutout, top, bottom } = profile;
    const hasIndicator = bottom > 0;
    return {
        id,
        name,
        brand: 'Apple',
        category: 'phone',
        platform: 'ios',
        input: 'touch',
        year,
        naturalOrientation: 'portrait',
        screen: { width, height, dpr, ppi, diagonal, cornerRadius },
        safeArea: {
            portrait: { top, right: 0, bottom, left: 0 },
            landscape: hasIndicator ? { top: 0, right: top, bottom: 21, left: top } : { top: 0, right: 0, bottom: 0, left: 0 },
        },
        cutout,
        homeIndicator: hasIndicator,
        statusBar: true,
    };
}
export const APPLE_IPHONES: readonly GuiDeviceSpec[] = [
    iphone('iphone-17-pro-max', 'iPhone 17 Pro Max', 2025, ISLAND_69),
    iphone('iphone-17-pro', 'iPhone 17 Pro', 2025, ISLAND_63),
    iphone('iphone-air', 'iPhone Air', 2025, AIR_65),
    iphone('iphone-17', 'iPhone 17', 2025, ISLAND_63),
    iphone('iphone-16e', 'iPhone 16e', 2025, STD_13),
    iphone('iphone-16-pro-max', 'iPhone 16 Pro Max', 2024, ISLAND_69),
    iphone('iphone-16-pro', 'iPhone 16 Pro', 2024, ISLAND_63),
    iphone('iphone-16-plus', 'iPhone 16 Plus', 2024, ISLAND_67),
    iphone('iphone-16', 'iPhone 16', 2024, ISLAND_61),
    iphone('iphone-15-pro-max', 'iPhone 15 Pro Max', 2023, ISLAND_67),
    iphone('iphone-15-pro', 'iPhone 15 Pro', 2023, ISLAND_61),
    iphone('iphone-15-plus', 'iPhone 15 Plus', 2023, ISLAND_67),
    iphone('iphone-15', 'iPhone 15', 2023, ISLAND_61),
    iphone('iphone-14-pro-max', 'iPhone 14 Pro Max', 2022, ISLAND_67),
    iphone('iphone-14-pro', 'iPhone 14 Pro', 2022, ISLAND_61),
    iphone('iphone-14-plus', 'iPhone 14 Plus', 2022, MAX_13),
    iphone('iphone-14', 'iPhone 14', 2022, STD_13),
    iphone('iphone-se-3', 'iPhone SE (3ª geração)', 2022, SE),
    iphone('iphone-13-pro-max', 'iPhone 13 Pro Max', 2021, MAX_13),
    iphone('iphone-13-pro', 'iPhone 13 Pro', 2021, STD_13),
    iphone('iphone-13', 'iPhone 13', 2021, STD_13),
    iphone('iphone-13-mini', 'iPhone 13 mini', 2021, MINI_13),
    iphone('iphone-12-pro-max', 'iPhone 12 Pro Max', 2020, MAX_12),
    iphone('iphone-12-pro', 'iPhone 12 Pro', 2020, STD_12),
    iphone('iphone-12', 'iPhone 12', 2020, STD_12),
    iphone('iphone-12-mini', 'iPhone 12 mini', 2020, MINI_12),
    iphone('iphone-11-pro-max', 'iPhone 11 Pro Max', 2019, XS_MAX_11_PRO_MAX),
    iphone('iphone-11-pro', 'iPhone 11 Pro', 2019, X_11_PRO),
    iphone('iphone-11', 'iPhone 11', 2019, XR_11),
];
