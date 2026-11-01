export const GAME_MANIFEST_FORMAT = 'helix-game';
export const GAME_MANIFEST_VERSION = 1;
export interface GameWindow {
    readonly width: number;
    readonly height: number;
    readonly fullscreen: boolean;
}
export interface GameNet {
    readonly authoritative: boolean;
    readonly serverUrl: string | null;
}
export interface GameManifest {
    readonly format: typeof GAME_MANIFEST_FORMAT;
    readonly formatVersion: number;
    readonly name: string;
    readonly slug: string;
    readonly version: string;
    readonly buildId: string;
    readonly company: string;
    readonly builtAt: number;
    readonly window: GameWindow;
    readonly engine: {
        readonly version: string;
        readonly player: string;
        readonly electron: string;
    };
    readonly settings: Readonly<Record<string, boolean | number | string>>;
    readonly net: GameNet;
}
export function parseGameManifest(input: unknown): GameManifest {
    const manifest = input as Partial<GameManifest> | null;
    if (!manifest || manifest.format !== GAME_MANIFEST_FORMAT || typeof manifest.name !== 'string' || typeof manifest.buildId !== 'string') {
        throw new Error('O manifesto do jogo (helix-game.json) está num formato desconhecido.');
    }
    if ((manifest.formatVersion ?? 0) > GAME_MANIFEST_VERSION)
        throw new Error('Este jogo foi compilado por uma versão mais nova da Helix Engine.');
    return manifest as GameManifest;
}
