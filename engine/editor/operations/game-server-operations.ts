import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { GAME_SERVER_MAX_PLAYERS, GAME_SERVER_TARGET_LABEL, GAME_SERVER_TICK_RATES, normalizeServerUrl, type GameServerSettings } from '@/engine/scripting/scripting-settings';
function clampTickRate(value: number): number {
    const rates = GAME_SERVER_TICK_RATES;
    return rates.reduce((best, rate) => (Math.abs(rate - value) < Math.abs(best - value) ? rate : best), rates[0]);
}
function labelFor(patch: Partial<GameServerSettings>): string {
    if (patch.mode !== undefined)
        return patch.mode === 'authoritative' ? 'Servidor autoritativo ligado' : 'Servidor autoritativo desligado';
    if (patch.url !== undefined)
        return patch.url ? 'Endereço do servidor' : 'Endereço do servidor removido';
    if (patch.tickRate !== undefined)
        return `Tick do servidor: ${patch.tickRate} Hz`;
    if (patch.maxPlayers !== undefined)
        return `Máximo de jogadores: ${patch.maxPlayers}`;
    if (patch.target !== undefined)
        return `Pacote de servidor: ${GAME_SERVER_TARGET_LABEL[patch.target]}`;
    return 'Servidor do jogo';
}
export function updateGameServer(session: EditorSession, patch: Partial<GameServerSettings>): void {
    const { server } = session.scene.scripting;
    const next: GameServerSettings = { ...server, ...patch };
    if (patch.url !== undefined)
        next.url = normalizeServerUrl(patch.url) ?? server.url;
    if (patch.tickRate !== undefined)
        next.tickRate = clampTickRate(patch.tickRate);
    if (patch.maxPlayers !== undefined)
        next.maxPlayers = Math.max(1, Math.min(GAME_SERVER_MAX_PLAYERS, Math.round(patch.maxPlayers) || 1));
    const keys = Object.keys(patch) as Array<keyof GameServerSettings>;
    if (keys.every((key) => next[key] === server[key]))
        return;
    session.history.execute(new SetValueCommand<GameServerSettings>(labelFor(patch), (value) => {
        Object.assign(session.scene.scripting.server, value);
        session.notify();
    }, { ...server }, next, keys.length === 1 ? `gameServer.${keys[0]}` : undefined));
}
export function setGameServerMode(session: EditorSession, authoritative: boolean): void {
    updateGameServer(session, { mode: authoritative ? 'authoritative' : 'none' });
}
