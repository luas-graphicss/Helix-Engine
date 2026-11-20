import { DEFAULT_CONNECTION_OPTIONS } from '@/engine/net/connection/connection';
import type { NetworkObject } from '@/engine/net/objects/network-object';
import type { NetClientOptions } from '@/engine/net/session/client-types';
import { NetClient } from '@/engine/net/session/net-client';
import { NetServer } from '@/engine/net/session/net-server';
import type { NetServerOptions } from '@/engine/net/session/server-types';
import { LoopbackHub, type LoopbackSocket } from '@/engine/net/transport/loopback-hub';
import type { NetworkConditions } from '@/engine/net/transport/network-conditions';
import type { NetValue } from '@/engine/net/wire/net-value';
import { seededRandom } from './net-test-support';
export const SESSION_ADDRESS = 'arena';
export const SESSION_SCHEMA = 'schema-a';
const FRAME_MS = 8;
export interface ReceivedInput {
    readonly playerId: number;
    readonly objectId: number;
    readonly tick: number;
    readonly input: NetValue;
}
export interface TestPlayer {
    readonly client: NetClient;
    readonly events: string[];
    readonly corrected: NetworkObject[];
    readonly sockets: LoopbackSocket[];
    frozen: boolean;
}
export interface SessionWorld {
    readonly hub: LoopbackHub;
    readonly server: NetServer;
    readonly events: string[];
    readonly inputs: ReceivedInput[];
    readonly players: TestPlayer[];
    grantOwnership: boolean;
    onTick: (tick: number, deltaSeconds: number) => void;
    join(name: string, overrides?: Partial<NetClientOptions>): TestPlayer;
    run(durationMs: number): void;
}
export function createSessionWorld(seed: number, conditions: NetworkConditions, overrides: Partial<NetServerOptions> = {}): SessionWorld {
    const hub = new LoopbackHub(seededRandom(seed));
    const clock = () => hub.timeMs;
    const events: string[] = [];
    const inputs: ReceivedInput[] = [];
    const players: TestPlayer[] = [];
    const world: SessionWorld = {
        hub,
        events,
        inputs,
        players,
        grantOwnership: true,
        onTick: () => undefined,
        server: new NetServer({ sessionId: SESSION_ADDRESS, schema: SESSION_SCHEMA, tickRate: 30, sendRate: 30, maxPlayers: 4, reconnectGraceMs: 3000, maxMessagesPerSecond: 240, maxViolations: 40, clock, connection: DEFAULT_CONNECTION_OPTIONS, ...overrides }, {
            playerJoined: (player) => events.push(`joined:${player.id}:${player.name}`),
            playerLeft: (player, reason) => events.push(`left:${player.id}:${reason}`),
            playerSuspended: (player) => events.push(`suspended:${player.id}`),
            playerResumed: (player) => events.push(`resumed:${player.id}`),
            inputReceived: (player, object, tick, input) => inputs.push({ playerId: player.id, objectId: object.id, tick, input }),
            ownershipRequested: () => world.grantOwnership,
            approvalFailed: (cause) => events.push(`approval-failed:${cause instanceof Error ? cause.message : String(cause)}`),
            ticked: (tick, deltaSeconds) => world.onTick(tick, deltaSeconds),
        }),
        join(name, clientOverrides = {}) {
            const sockets: LoopbackSocket[] = [];
            const playerEvents: string[] = [];
            const corrected: NetworkObject[] = [];
            const client = new NetClient({
                name,
                ticket: null,
                schema: SESSION_SCHEMA,
                clock,
                openSocket: () => {
                    const socket = hub.connect(SESSION_ADDRESS, conditions);
                    sockets.push(socket);
                    return socket;
                },
                reconnectAttempts: 5,
                reconnectBaseDelayMs: 200,
                connection: DEFAULT_CONNECTION_OPTIONS,
                ...clientOverrides,
            }, {
                connected: (resumed) => playerEvents.push(resumed ? 'resumed' : 'connected'),
                reconnecting: (attempt) => playerEvents.push(`reconnecting:${attempt}`),
                disconnected: (reason) => playerEvents.push(`disconnected:${reason}`),
                playerJoined: (player) => playerEvents.push(`joined:${player.id}`),
                playerLeft: (player, reason) => playerEvents.push(`left:${player.id}:${reason}`),
                corrected: (object) => corrected.push(object),
            });
            const player: TestPlayer = { client, events: playerEvents, corrected, sockets, frozen: false };
            players.push(player);
            client.start();
            return player;
        },
        run(durationMs) {
            for (let elapsed = 0; elapsed < durationMs; elapsed += FRAME_MS) {
                hub.advance(FRAME_MS);
                world.server.update();
                for (const player of players)
                    if (!player.frozen)
                        player.client.update();
            }
        },
    };
    hub.listen(SESSION_ADDRESS, (socket) => world.server.accept(socket));
    return world;
}
export function requireObject(object: NetworkObject | undefined): NetworkObject {
    if (!object)
        throw new Error('The network object was expected to exist.');
    return object;
}
