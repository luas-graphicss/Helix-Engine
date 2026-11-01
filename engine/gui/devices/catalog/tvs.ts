import type { GuiDevicePlatform, GuiDeviceSpec } from '../device-model';
const TITLE_SAFE = 0.05;
interface TvProfile {
    readonly width: number;
    readonly height: number;
    readonly dpr: number;
    readonly diagonal: number;
    readonly platform: GuiDevicePlatform;
}
function tv(id: string, name: string, brand: string, year: number, profile: TvProfile): GuiDeviceSpec {
    const { width, height, dpr, diagonal, platform } = profile;
    const horizontal = Math.round(width * TITLE_SAFE);
    const vertical = Math.round(height * TITLE_SAFE);
    return {
        id,
        name,
        brand,
        category: 'tv',
        platform,
        input: 'gamepad',
        year,
        naturalOrientation: 'landscape',
        screen: { width, height, dpr, ppi: Math.round(Math.hypot(width * dpr, height * dpr) / diagonal), diagonal, cornerRadius: 0 },
        safeArea: {
            landscape: { top: vertical, right: horizontal, bottom: vertical, left: horizontal },
            portrait: { top: horizontal, right: vertical, bottom: horizontal, left: vertical },
        },
        cutout: null,
        homeIndicator: false,
        statusBar: false,
    };
}
export const TVS: readonly GuiDeviceSpec[] = [
    tv('tv-fhd', 'TV Full HD 55" (1080p)', 'Genérico', 0, { width: 1920, height: 1080, dpr: 1, diagonal: 55, platform: 'smart-tv' }),
    tv('tv-4k-ui-1080', 'TV 4K 55" · interface em 1080p', 'Genérico', 0, { width: 1920, height: 1080, dpr: 2, diagonal: 55, platform: 'smart-tv' }),
    tv('tv-4k-native', 'TV 4K 65" · nativa (2160p)', 'Genérico', 0, { width: 3840, height: 2160, dpr: 1, diagonal: 65, platform: 'smart-tv' }),
    tv('tv-hd', 'TV HD 32" (720p)', 'Genérico', 0, { width: 1280, height: 720, dpr: 1, diagonal: 32, platform: 'smart-tv' }),
    tv('apple-tv-4k', 'Apple TV 4K', 'Apple', 2022, { width: 1920, height: 1080, dpr: 2, diagonal: 55, platform: 'tvos' }),
    tv('console-1080p', 'Console na TV · 1080p (PlayStation, Xbox, Switch)', 'Genérico', 0, { width: 1920, height: 1080, dpr: 1, diagonal: 55, platform: 'playstation' }),
    tv('console-4k', 'Console na TV · 4K', 'Genérico', 0, { width: 3840, height: 2160, dpr: 1, diagonal: 65, platform: 'playstation' }),
];
