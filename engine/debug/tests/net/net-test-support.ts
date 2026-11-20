import { Connection, DEFAULT_CONNECTION_OPTIONS, type ConnectionOptions } from '@/engine/net/connection/connection';
import type { Delivery } from '@/engine/net/connection/delivery';
import { LoopbackHub } from '@/engine/net/transport/loopback-hub';
import type { NetworkConditions } from '@/engine/net/transport/network-conditions';
const UINT32_RANGE = 0x100000000;
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
    };
}
export interface ReceivedMessage {
    readonly payload: Uint8Array;
    readonly delivery: Delivery;
}
export interface ConnectionProbe {
    readonly received: ReceivedMessage[];
    opened: boolean;
    closedWith: string | null;
}
export interface LinkedPair {
    readonly hub: LoopbackHub;
    readonly client: Connection;
    readonly clientProbe: ConnectionProbe;
    readonly serverProbe: ConnectionProbe;
    server(): Connection;
    run(durationMs: number, stepMs?: number): void;
    runClientOnly(durationMs: number, stepMs?: number): void;
}
function createProbe(): ConnectionProbe {
    return { received: [], opened: false, closedWith: null };
}
function listenerFor(probe: ConnectionProbe) {
    return {
        opened: () => {
            probe.opened = true;
        },
        message: (payload: Uint8Array, delivery: Delivery) => {
            probe.received.push({ payload, delivery });
        },
        closed: (reason: string) => {
            probe.closedWith = reason;
        },
    };
}
export function linkConnections(conditions: NetworkConditions, seed: number, options: ConnectionOptions = DEFAULT_CONNECTION_OPTIONS): LinkedPair {
    const hub = new LoopbackHub(seededRandom(seed));
    const clock = () => hub.timeMs;
    const clientProbe = createProbe();
    const serverProbe = createProbe();
    let accepted: Connection | null = null;
    hub.listen('game', (socket) => {
        accepted = new Connection(socket, clock, listenerFor(serverProbe), options);
    });
    const client = new Connection(hub.connect('game', conditions), clock, listenerFor(clientProbe), options);
    const server = (): Connection => {
        if (!accepted)
            throw new Error('The server never accepted the connection.');
        return accepted;
    };
    const step = (stepMs: number, includeServer: boolean): void => {
        hub.advance(stepMs);
        client.update();
        if (includeServer)
            accepted?.update();
    };
    return {
        hub,
        client,
        clientProbe,
        serverProbe,
        server,
        run(durationMs, stepMs = 10) {
            for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs)
                step(stepMs, true);
        },
        runClientOnly(durationMs, stepMs = 10) {
            for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs)
                step(stepMs, false);
        },
    };
}
export function numberedPayload(index: number): Uint8Array {
    return Uint8Array.of(index & 0xff, (index >> 8) & 0xff, (index >> 16) & 0xff);
}
export function payloadNumber(payload: Uint8Array): number {
    return payload[0] | (payload[1] << 8) | (payload[2] << 16);
}
