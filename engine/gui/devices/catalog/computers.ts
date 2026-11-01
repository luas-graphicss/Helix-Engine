import { GUI_NO_SAFE_AREA, type GuiDevicePlatform, type GuiDeviceSpec } from '../device-model';
interface ComputerProfile {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly ppi: number | null;
    readonly diagonal: number;
    readonly platform: GuiDevicePlatform;
}
function computer(category: 'desktop' | 'laptop', id: string, name: string, brand: string, year: number, profile: ComputerProfile): GuiDeviceSpec {
    const { width, height, dpr, ppi, diagonal, platform } = profile;
    return {
        id,
        name,
        brand,
        category,
        platform,
        input: 'pointer',
        year,
        naturalOrientation: 'landscape',
        screen: { width, height, dpr, ppi, diagonal, cornerRadius: 0 },
        safeArea: GUI_NO_SAFE_AREA,
        cutout: null,
        homeIndicator: false,
        statusBar: false,
    };
}
const monitor = (id: string, name: string, brand: string, year: number, profile: ComputerProfile) => computer('desktop', id, name, brand, year, profile);
const laptop = (id: string, name: string, brand: string, year: number, profile: ComputerProfile) => computer('laptop', id, name, brand, year, profile);
function ppiOf(physicalWidth: number, physicalHeight: number, diagonal: number): number {
    return Math.round(Math.hypot(physicalWidth, physicalHeight) / diagonal);
}
export const DESKTOPS: readonly GuiDeviceSpec[] = [
    monitor('monitor-fhd-24', 'Monitor Full HD 24"', 'Genérico', 0, { width: 1920, height: 1080, dpr: 1, ppi: ppiOf(1920, 1080, 24), diagonal: 24, platform: 'windows' }),
    monitor('monitor-fhd-27', 'Monitor Full HD 27"', 'Genérico', 0, { width: 1920, height: 1080, dpr: 1, ppi: ppiOf(1920, 1080, 27), diagonal: 27, platform: 'windows' }),
    monitor('monitor-fhd-125', 'Monitor Full HD · Windows 125 %', 'Genérico', 0, { width: 1536, height: 864, dpr: 1.25, ppi: ppiOf(1920, 1080, 24), diagonal: 24, platform: 'windows' }),
    monitor('monitor-qhd-27', 'Monitor QHD 27"', 'Genérico', 0, { width: 2560, height: 1440, dpr: 1, ppi: ppiOf(2560, 1440, 27), diagonal: 27, platform: 'windows' }),
    monitor('monitor-qhd-125', 'Monitor QHD · Windows 125 %', 'Genérico', 0, { width: 2048, height: 1152, dpr: 1.25, ppi: ppiOf(2560, 1440, 27), diagonal: 27, platform: 'windows' }),
    monitor('monitor-4k-27-native', 'Monitor 4K 27" · nativo', 'Genérico', 0, { width: 3840, height: 2160, dpr: 1, ppi: ppiOf(3840, 2160, 27), diagonal: 27, platform: 'windows' }),
    monitor('monitor-4k-150', 'Monitor 4K · Windows 150 %', 'Genérico', 0, { width: 2560, height: 1440, dpr: 1.5, ppi: ppiOf(3840, 2160, 27), diagonal: 27, platform: 'windows' }),
    monitor('monitor-4k-200', 'Monitor 4K · escala 200 %', 'Genérico', 0, { width: 1920, height: 1080, dpr: 2, ppi: ppiOf(3840, 2160, 27), diagonal: 27, platform: 'windows' }),
    monitor('monitor-4k-32-native', 'Monitor 4K 32" · nativo', 'Genérico', 0, { width: 3840, height: 2160, dpr: 1, ppi: ppiOf(3840, 2160, 32), diagonal: 32, platform: 'windows' }),
    monitor('monitor-wuxga', 'Monitor WUXGA 16:10 (1920×1200)', 'Genérico', 0, { width: 1920, height: 1200, dpr: 1, ppi: ppiOf(1920, 1200, 24), diagonal: 24, platform: 'windows' }),
    monitor('monitor-wqxga', 'Monitor WQXGA 16:10 (2560×1600)', 'Genérico', 0, { width: 2560, height: 1600, dpr: 1, ppi: ppiOf(2560, 1600, 30), diagonal: 30, platform: 'windows' }),
    monitor('monitor-ultrawide-34', 'Ultrawide 34" (3440×1440)', 'Genérico', 0, { width: 3440, height: 1440, dpr: 1, ppi: ppiOf(3440, 1440, 34), diagonal: 34, platform: 'windows' }),
    monitor('monitor-superwide-49', 'Super ultrawide 49" (5120×1440)', 'Genérico', 0, { width: 5120, height: 1440, dpr: 1, ppi: ppiOf(5120, 1440, 49), diagonal: 49, platform: 'windows' }),
    monitor('monitor-hd-plus', 'Monitor HD+ (1600×900)', 'Genérico', 0, { width: 1600, height: 900, dpr: 1, ppi: ppiOf(1600, 900, 20), diagonal: 20, platform: 'windows' }),
    monitor('monitor-hd', 'Monitor HD (1280×720)', 'Genérico', 0, { width: 1280, height: 720, dpr: 1, ppi: ppiOf(1280, 720, 18.5), diagonal: 18.5, platform: 'windows' }),
    monitor('monitor-sxga', 'Monitor 5:4 (1280×1024)', 'Genérico', 0, { width: 1280, height: 1024, dpr: 1, ppi: ppiOf(1280, 1024, 19), diagonal: 19, platform: 'windows' }),
    monitor('monitor-xga', 'Monitor 4:3 (1024×768)', 'Genérico', 0, { width: 1024, height: 768, dpr: 1, ppi: ppiOf(1024, 768, 15), diagonal: 15, platform: 'windows' }),
    monitor('monitor-uxga', 'Monitor 4:3 (1600×1200)', 'Genérico', 0, { width: 1600, height: 1200, dpr: 1, ppi: ppiOf(1600, 1200, 20), diagonal: 20, platform: 'windows' }),
    monitor('imac-24', 'iMac 24" (4.5K)', 'Apple', 2021, { width: 2240, height: 1260, dpr: 2, ppi: 218, diagonal: 24, platform: 'macos' }),
    monitor('studio-display', 'Studio Display 27" (5K)', 'Apple', 2022, { width: 2560, height: 1440, dpr: 2, ppi: 218, diagonal: 27, platform: 'macos' }),
    monitor('pro-display-xdr', 'Pro Display XDR 32" (6K)', 'Apple', 2019, { width: 3008, height: 1692, dpr: 2, ppi: 218, diagonal: 32, platform: 'macos' }),
];
export const LAPTOPS: readonly GuiDeviceSpec[] = [
    laptop('macbook-air-13', 'MacBook Air 13" (M2–M4)', 'Apple', 2022, { width: 1470, height: 956, dpr: 2, ppi: 224, diagonal: 13.6, platform: 'macos' }),
    laptop('macbook-air-15', 'MacBook Air 15"', 'Apple', 2023, { width: 1710, height: 1112, dpr: 2, ppi: 224, diagonal: 15.3, platform: 'macos' }),
    laptop('macbook-pro-14', 'MacBook Pro 14"', 'Apple', 2021, { width: 1512, height: 982, dpr: 2, ppi: 254, diagonal: 14.2, platform: 'macos' }),
    laptop('macbook-pro-16', 'MacBook Pro 16"', 'Apple', 2021, { width: 1728, height: 1117, dpr: 2, ppi: 254, diagonal: 16.2, platform: 'macos' }),
    laptop('macbook-pro-13-m2', 'MacBook Pro 13" (M1/M2)', 'Apple', 2020, { width: 1440, height: 900, dpr: 2, ppi: 227, diagonal: 13.3, platform: 'macos' }),
    laptop('surface-laptop-13', 'Surface Laptop 13,8"', 'Microsoft', 2024, { width: 1536, height: 1024, dpr: 1.5, ppi: 201, diagonal: 13.8, platform: 'windows' }),
    laptop('surface-pro-13', 'Surface Pro 13"', 'Microsoft', 2024, { width: 1440, height: 960, dpr: 2, ppi: 267, diagonal: 13, platform: 'windows' }),
    laptop('xps-13', 'XPS 13 (FHD+)', 'Dell', 2024, { width: 1536, height: 960, dpr: 1.25, ppi: 169, diagonal: 13.4, platform: 'windows' }),
    laptop('xps-15-oled', 'XPS 15 (3.5K OLED)', 'Dell', 2023, { width: 1728, height: 1080, dpr: 2, ppi: 261, diagonal: 15.6, platform: 'windows' }),
    laptop('notebook-fhd-100', 'Notebook Full HD 15,6" · 100 %', 'Genérico', 0, { width: 1920, height: 1080, dpr: 1, ppi: 141, diagonal: 15.6, platform: 'windows' }),
    laptop('notebook-fhd-125', 'Notebook Full HD 15,6" · 125 %', 'Genérico', 0, { width: 1536, height: 864, dpr: 1.25, ppi: 141, diagonal: 15.6, platform: 'windows' }),
    laptop('notebook-fhd-150', 'Notebook Full HD 14" · 150 %', 'Genérico', 0, { width: 1280, height: 720, dpr: 1.5, ppi: 157, diagonal: 14, platform: 'windows' }),
    laptop('notebook-hd', 'Notebook HD (1366×768)', 'Genérico', 0, { width: 1366, height: 768, dpr: 1, ppi: 100, diagonal: 15.6, platform: 'windows' }),
    laptop('chromebook-14', 'Chromebook 14" Full HD · 125 %', 'Genérico', 0, { width: 1536, height: 864, dpr: 1.25, ppi: 157, diagonal: 14, platform: 'chromeos' }),
];
