import { GUI_NO_SAFE_AREA, type GuiDeviceInput, type GuiDevicePlatform, type GuiDeviceSpec } from '../device-model';
interface HandheldProfile {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly ppi: number;
    readonly diagonal: number;
    readonly platform: GuiDevicePlatform;
    readonly input: GuiDeviceInput;
    readonly cornerRadius?: number;
}
function handheld(id: string, name: string, brand: string, year: number, profile: HandheldProfile): GuiDeviceSpec {
    const { width, height, dpr, ppi, diagonal, platform, input, cornerRadius = 0 } = profile;
    return {
        id,
        name,
        brand,
        category: 'handheld',
        platform,
        input,
        year,
        naturalOrientation: 'landscape',
        screen: { width, height, dpr, ppi, diagonal, cornerRadius },
        safeArea: GUI_NO_SAFE_AREA,
        cutout: null,
        homeIndicator: false,
        statusBar: false,
    };
}
export const HANDHELDS: readonly GuiDeviceSpec[] = [
    handheld('steam-deck-oled', 'Steam Deck OLED', 'Valve', 2023, { width: 1280, height: 800, dpr: 1, ppi: 204, diagonal: 7.4, platform: 'steamos', input: 'gamepad', cornerRadius: 8 }),
    handheld('steam-deck-lcd', 'Steam Deck LCD', 'Valve', 2022, { width: 1280, height: 800, dpr: 1, ppi: 215, diagonal: 7, platform: 'steamos', input: 'gamepad' }),
    handheld('switch-2', 'Nintendo Switch 2 (portátil)', 'Nintendo', 2025, { width: 1920, height: 1080, dpr: 1, ppi: 279, diagonal: 7.9, platform: 'nintendo', input: 'gamepad' }),
    handheld('switch-oled', 'Nintendo Switch OLED (portátil)', 'Nintendo', 2021, { width: 1280, height: 720, dpr: 1, ppi: 209, diagonal: 7, platform: 'nintendo', input: 'gamepad' }),
    handheld('switch', 'Nintendo Switch (portátil)', 'Nintendo', 2017, { width: 1280, height: 720, dpr: 1, ppi: 237, diagonal: 6.2, platform: 'nintendo', input: 'gamepad' }),
    handheld('rog-ally', 'ROG Ally · Windows 150 %', 'ASUS', 2023, { width: 1280, height: 720, dpr: 1.5, ppi: 315, diagonal: 7, platform: 'windows', input: 'gamepad' }),
    handheld('legion-go', 'Legion Go · Windows 150 %', 'Lenovo', 2023, { width: 1707, height: 1067, dpr: 1.5, ppi: 343, diagonal: 8.8, platform: 'windows', input: 'gamepad' }),
    handheld('playstation-portal', 'PlayStation Portal', 'Sony', 2023, { width: 1920, height: 1080, dpr: 1, ppi: 275, diagonal: 8, platform: 'playstation', input: 'gamepad' }),
];
