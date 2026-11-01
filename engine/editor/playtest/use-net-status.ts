'use client';
import { useEffect, useState } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { NetTransportKind } from '@/engine/net/transport/endpoint';
export interface NetStatus {
    readonly running: boolean;
    readonly transport: NetTransportKind;
    readonly connected: boolean;
    readonly connecting: boolean;
    readonly latencyMs: number;
    readonly room: string;
    readonly address: string | null;
    readonly players: number;
}
const IDLE: NetStatus = { running: false, transport: 'none', connected: false, connecting: false, latencyMs: 0, room: '', address: null, players: 0 };
const POLL_MS = 400;
function snapshot(session: EditorSession): NetStatus {
    const { scripts } = session;
    if (!scripts.running || scripts.mode !== 'play')
        return IDLE;
    const { net } = scripts;
    return {
        running: true,
        transport: net.transport,
        connected: net.isConnected,
        connecting: net.isConnecting,
        latencyMs: Math.round(net.latency),
        room: net.room,
        address: net.address,
        players: net.transport === 'websocket' ? net.knownPlayerCount : net.playerCount,
    };
}
function sameStatus(a: NetStatus, b: NetStatus): boolean {
    return a.running === b.running && a.transport === b.transport && a.connected === b.connected && a.connecting === b.connecting && a.latencyMs === b.latencyMs && a.room === b.room && a.address === b.address && a.players === b.players;
}
export function useNetStatus(session: EditorSession): NetStatus {
    const [status, setStatus] = useState<NetStatus>(() => snapshot(session));
    useEffect(() => {
        const refresh = () => setStatus((previous) => {
            const next = snapshot(session);
            return sameStatus(previous, next) ? previous : next;
        });
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        return () => clearInterval(timer);
    }, [session]);
    return status;
}
