import type { ScriptLanguageId } from './script-languages';
export type GameServerMode = 'none' | 'authoritative';
export type GameServerTarget = 'node' | 'docker' | 'cloudflare';
export interface GameServerSettings {
    mode: GameServerMode;
    url: string;
    tickRate: number;
    maxPlayers: number;
    target: GameServerTarget;
}
export const GAME_SERVER_TARGETS: readonly GameServerTarget[] = ['node', 'docker', 'cloudflare'];
export const GAME_SERVER_TARGET_LABEL: Record<GameServerTarget, string> = {
    node: 'Node.js',
    docker: 'Docker',
    cloudflare: 'Cloudflare Workers',
};
export const GAME_SERVER_TARGET_HINT: Record<GameServerTarget, string> = {
    node: 'Um processo `node server.mjs` em qualquer VPS, Railway, Fly.io ou máquina própria.',
    docker: 'Imagem pronta a partir do mesmo servidor Node, para Fly.io, Render, Kubernetes ou a sua infraestrutura.',
    cloudflare: 'Um Worker com Durable Object por sala: sem servidor para cuidar, escala por sala.',
};
export const GAME_SERVER_TICK_RATES: readonly number[] = [10, 20, 30, 60];
export const GAME_SERVER_MAX_PLAYERS = 256;
export function createGameServerSettings(): GameServerSettings {
    return { mode: 'none', url: '', tickRate: 20, maxPlayers: 16, target: 'node' };
}
export interface ScriptingSettings {
    baseLanguage: ScriptLanguageId | null;
    entryScriptId: string | null;
    server: GameServerSettings;
}
export function createScriptingSettings(): ScriptingSettings {
    return { baseLanguage: null, entryScriptId: null, server: createGameServerSettings() };
}
export function isAuthoritative(settings: ScriptingSettings): boolean {
    return settings.server.mode === 'authoritative';
}
export function normalizeServerUrl(value: string): string | null {
    const text = value.trim();
    if (!text)
        return '';
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `wss://${text}`;
    try {
        const url = new URL(withScheme);
        if (url.protocol === 'http:')
            url.protocol = 'ws:';
        else if (url.protocol === 'https:')
            url.protocol = 'wss:';
        if (url.protocol !== 'ws:' && url.protocol !== 'wss:')
            return null;
        return url.toString().replace(/\/$/, '');
    }
    catch {
        return null;
    }
}
