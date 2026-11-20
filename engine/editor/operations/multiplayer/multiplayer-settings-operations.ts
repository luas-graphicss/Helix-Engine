import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { normalizeMultiplayerSettings, type MultiplayerSettings } from '@/engine/net/settings/multiplayer-settings';
type SessionFields = Pick<MultiplayerSettings, 'topology' | 'sendRate' | 'autoJoin' | 'defaultSession' | 'reconnectGraceSeconds'>;
export function editMultiplayer(session: EditorSession, label: string, edit: (settings: MultiplayerSettings) => MultiplayerSettings, mergeKey?: string): void {
    const before = structuredClone(session.scene.multiplayer);
    const next = normalizeMultiplayerSettings(edit(structuredClone(before)));
    if (JSON.stringify(next) === JSON.stringify(before))
        return;
    session.history.execute(new SetValueCommand<MultiplayerSettings>(label, (value) => {
        Object.assign(session.scene.multiplayer, structuredClone(value));
        session.notify();
    }, before, next, mergeKey));
}
export function setMultiplayerEnabled(session: EditorSession, enabled: boolean): void {
    editMultiplayer(session, enabled ? 'Multiplayer ligado' : 'Multiplayer desligado', (settings) => ({ ...settings, enabled }));
}
export function updateMultiplayerSession(session: EditorSession, patch: Partial<SessionFields>): void {
    const keys = Object.keys(patch);
    editMultiplayer(session, 'Sessão do multiplayer', (settings) => ({ ...settings, ...patch }), keys.length === 1 ? `multiplayer.${keys[0]}` : undefined);
}
export function updateLobbySettings(session: EditorSession, patch: Partial<MultiplayerSettings['lobby']>): void {
    editMultiplayer(session, 'Lobby do multiplayer', (settings) => ({ ...settings, lobby: { ...settings.lobby, ...patch } }), 'multiplayer.lobby');
}
export function setMatchmakingEnabled(session: EditorSession, enabled: boolean): void {
    editMultiplayer(session, enabled ? 'Matchmaking ligado' : 'Matchmaking desligado', (settings) => ({ ...settings, matchmaking: { ...settings.matchmaking, enabled } }));
}
export function setRelayEnabled(session: EditorSession, enabled: boolean): void {
    editMultiplayer(session, enabled ? 'Relay ligado' : 'Relay desligado', (settings) => ({ ...settings, relay: { enabled } }));
}
export function updateSessionServer(session: EditorSession, patch: Partial<MultiplayerSettings['server']>): void {
    editMultiplayer(session, 'Limites do servidor de sessões', (settings) => ({ ...settings, server: { ...settings.server, ...patch } }), 'multiplayer.server');
}
