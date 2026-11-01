import { BUILD_PLATFORMS, BUILD_STORES, BUILD_WINDOW_MODES, type BuildOptions, type BuildPlatformId, type BuildStoreId, type BuildWindowMode } from './build-targets';
const OPTIONS_KEY = 'helix-build:options';
type StoredBuildOptions = Omit<BuildOptions, 'icon' | 'format'>;
function readAll(): Record<string, Partial<StoredBuildOptions>> {
    if (typeof localStorage === 'undefined')
        return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, Partial<StoredBuildOptions>>) : {};
    }
    catch {
        return {};
    }
}
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
const PLATFORM_IDS = BUILD_PLATFORMS.map((platform) => platform.id);
const STORE_IDS = BUILD_STORES.map((store) => store.id);
const WINDOW_IDS = BUILD_WINDOW_MODES.map((mode) => mode.id);
function guessPlatform(): BuildPlatformId {
    if (typeof navigator === 'undefined')
        return 'win32-x64';
    const agent = navigator.userAgent;
    if (/Macintosh|Mac OS X/.test(agent))
        return 'darwin-arm64';
    if (/Linux/.test(agent) && !/Android/.test(agent))
        return 'linux-x64';
    return 'win32-x64';
}
export function defaultBuildOptions(gameName: string): BuildOptions {
    return { platform: guessPlatform(), store: 'direct', format: 'zip', gameName, version: '1.0.0', company: '', window: 'fullscreen', icon: null, steamAppId: '' };
}
export function loadBuildOptions(projectId: string, gameName: string): BuildOptions {
    const defaults = defaultBuildOptions(gameName);
    const stored = readAll()[projectId];
    if (!stored)
        return defaults;
    return {
        ...defaults,
        platform: pick<BuildPlatformId>(stored.platform, PLATFORM_IDS, defaults.platform),
        store: pick<BuildStoreId>(stored.store, STORE_IDS, defaults.store),
        window: pick<BuildWindowMode>(stored.window, WINDOW_IDS, defaults.window),
        gameName: typeof stored.gameName === 'string' && stored.gameName.trim() ? stored.gameName : gameName,
        version: typeof stored.version === 'string' ? stored.version : defaults.version,
        company: typeof stored.company === 'string' ? stored.company : defaults.company,
        steamAppId: typeof stored.steamAppId === 'string' ? stored.steamAppId : defaults.steamAppId,
    };
}
export function saveBuildOptions(projectId: string, options: BuildOptions): void {
    if (typeof localStorage === 'undefined')
        return;
    const { platform, store, gameName, version, company, window, steamAppId } = options;
    try {
        localStorage.setItem(OPTIONS_KEY, JSON.stringify({ ...readAll(), [projectId]: { platform, store, gameName, version, company, window, steamAppId } }));
    }
    catch {
    }
}
