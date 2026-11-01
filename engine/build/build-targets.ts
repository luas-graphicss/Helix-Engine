export const HELIX_PLAYER_ELECTRON_VERSION = '45.1.0';
export type BuildPlatformId = 'win32-x64' | 'win32-arm64' | 'darwin-arm64' | 'darwin-x64' | 'linux-x64';
export type BuildStoreId = 'steam' | 'itch' | 'direct';
export type BuildWindowMode = 'fullscreen' | '1920x1080' | '1280x720';
export type BuildFormatId = 'zip';
export interface BuildPlatform {
    readonly id: BuildPlatformId;
    readonly label: string;
    readonly os: 'windows' | 'macos' | 'linux';
    readonly arch: 'x64' | 'arm64';
    readonly asset: string;
    readonly templateBytes: number;
    readonly hint: string;
}
export const BUILD_PLATFORMS: readonly BuildPlatform[] = [
    { id: 'win32-x64', label: 'Windows (64 bits)', os: 'windows', arch: 'x64', asset: `electron-v${HELIX_PLAYER_ELECTRON_VERSION}-win32-x64.zip`, templateBytes: 158224448, hint: 'Steam, itch.io e distribuição direta. O alvo mais comum.' },
    { id: 'win32-arm64', label: 'Windows (ARM64)', os: 'windows', arch: 'arm64', asset: `electron-v${HELIX_PLAYER_ELECTRON_VERSION}-win32-arm64.zip`, templateBytes: 155969843, hint: 'Notebooks Windows com Snapdragon. Raramente necessário.' },
    { id: 'darwin-arm64', label: 'macOS (Apple Silicon)', os: 'macos', arch: 'arm64', asset: `electron-v${HELIX_PLAYER_ELECTRON_VERSION}-darwin-arm64.zip`, templateBytes: 120939367, hint: 'Macs M1 em diante. Precisa de assinatura e notarização num Mac antes de distribuir.' },
    { id: 'darwin-x64', label: 'macOS (Intel)', os: 'macos', arch: 'x64', asset: `electron-v${HELIX_PLAYER_ELECTRON_VERSION}-darwin-x64.zip`, templateBytes: 125139936, hint: 'Macs Intel. Precisa de assinatura e notarização num Mac antes de distribuir.' },
    { id: 'linux-x64', label: 'Linux (64 bits)', os: 'linux', arch: 'x64', asset: `electron-v${HELIX_PLAYER_ELECTRON_VERSION}-linux-x64.zip`, templateBytes: 123917468, hint: 'Steam Deck e distribuições de 64 bits.' },
];
export function buildPlatformOf(id: BuildPlatformId): BuildPlatform {
    const platform = BUILD_PLATFORMS.find((candidate) => candidate.id === id);
    if (!platform)
        throw new Error(`Plataforma desconhecida: ${id}`);
    return platform;
}
export interface BuildStore {
    readonly id: BuildStoreId;
    readonly label: string;
    readonly hint: string;
}
export const BUILD_STORES: readonly BuildStore[] = [
    { id: 'steam', label: 'Steam', hint: 'Pasta pronta para virar um depot no SteamPipe; inclui steam_appid.txt quando o App ID é informado.' },
    { id: 'itch', label: 'itch.io', hint: 'Inclui o manifesto .itch.toml com a ação de lançar, para o app do itch abrir o jogo direto.' },
    { id: 'direct', label: 'Distribuição direta', hint: 'Só a pasta do jogo, para o seu site, Epic, GOG ou qualquer outra loja.' },
];
export const BUILD_WINDOW_MODES: readonly {
    id: BuildWindowMode;
    label: string;
}[] = [
    { id: 'fullscreen', label: 'Tela cheia' },
    { id: '1920x1080', label: 'Janela 1920×1080' },
    { id: '1280x720', label: 'Janela 1280×720' },
];
export interface BuildOptions {
    readonly platform: BuildPlatformId;
    readonly store: BuildStoreId;
    readonly format: BuildFormatId;
    readonly gameName: string;
    readonly version: string;
    readonly company: string;
    readonly window: BuildWindowMode;
    readonly icon: Blob | null;
    readonly steamAppId: string;
}
export function gameSlug(name: string): string {
    const slug = name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return slug || 'jogo';
}
export function executableBaseName(name: string): string {
    const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/g, '').trim();
    return cleaned || 'Jogo';
}
export function normalizeVersion(input: string): string {
    const parts = input
        .trim()
        .split('.')
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part) && part >= 0);
    while (parts.length < 3)
        parts.push(0);
    return parts.slice(0, 4).join('.');
}
export function windowSizeOf(mode: BuildWindowMode): {
    width: number;
    height: number;
    fullscreen: boolean;
} {
    switch (mode) {
        case '1920x1080':
            return { width: 1920, height: 1080, fullscreen: false };
        case '1280x720':
            return { width: 1280, height: 720, fullscreen: false };
        default:
            return { width: 1280, height: 720, fullscreen: true };
    }
}
export function buildArtifactName(options: BuildOptions): string {
    const platform = buildPlatformOf(options.platform);
    return `${gameSlug(options.gameName)}-${normalizeVersion(options.version)}-${platform.os}-${platform.arch}.zip`;
}
