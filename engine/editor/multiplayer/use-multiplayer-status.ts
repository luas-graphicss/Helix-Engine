'use client';
import { useEffect, useState } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ConnectionStats } from '@/engine/net/connection/connection';
import type { SessionPhase } from '@/engine/net/runtime/runtime-events';
import type { SessionLinkKind } from '@/engine/net/runtime/session-link';
import type { ServerStatus } from '@/engine/net/server/multiplayer-server';
import type { SessionPlayer } from '@/engine/net/session/session-protocol';
export interface MultiplayerStatus {
    readonly playing: boolean;
    readonly active: boolean;
    readonly phase: SessionPhase;
    readonly linkKind: SessionLinkKind | null;
    readonly isHost: boolean;
    readonly sessionId: string;
    readonly joinCode: string;
    readonly localPlayerId: number;
    readonly players: readonly SessionPlayer[];
    readonly objects: number;
    readonly testClients: number;
    readonly stats: ConnectionStats | null;
    readonly server: ServerStatus | null;
}
const POLL_MS = 500;
const IDLE: MultiplayerStatus = { playing: false, active: false, phase: 'offline', linkKind: null, isHost: false, sessionId: '', joinCode: '', localPlayerId: 0, players: [], objects: 0, testClients: 0, stats: null, server: null };
function snapshot(session: EditorSession): MultiplayerStatus {
    const { scripts } = session;
    const runtime = scripts.multiplayer;
    const playing = scripts.running && scripts.mode === 'play';
    if (!playing || !runtime.isActive)
        return { ...IDLE, playing };
    return {
        playing,
        active: true,
        phase: runtime.phase,
        linkKind: runtime.link?.kind ?? null,
        isHost: runtime.isHost,
        sessionId: runtime.sessionId,
        joinCode: runtime.joinCode,
        localPlayerId: runtime.localPlayerId,
        players: runtime.players,
        objects: runtime.binding?.size ?? 0,
        testClients: runtime.testClientCount,
        stats: runtime.stats,
        server: runtime.serverStatus,
    };
}
export function useMultiplayerStatus(session: EditorSession): MultiplayerStatus {
    const [status, setStatus] = useState<MultiplayerStatus>(() => snapshot(session));
    useEffect(() => {
        const refresh = () => setStatus((previous) => {
            const next = snapshot(session);
            return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        return () => clearInterval(timer);
    }, [session]);
    return status;
}
