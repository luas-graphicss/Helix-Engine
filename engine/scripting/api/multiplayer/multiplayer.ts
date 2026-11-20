import * as quat from '@/engine/core/math/quat';
import type { SessionPhase } from '@/engine/net/runtime/runtime-events';
import { readEntityTransform } from '@/engine/net/scene/entity-transform';
import type { SessionPlayer } from '@/engine/net/session/session-protocol';
import { createTransformState } from '@/engine/net/sync/transform-state';
import { describeDisconnect } from '@/engine/net/transport/disconnect-reason';
import { MULTIPLAYER_EVENT } from '../../runtime/multiplayer-bridge';
import type { RuntimeHost } from '../../runtime/runtime-host';
import { optionalNumber, requireEntity, requireNumber, requireObject, requireString, toVec3 } from '../../runtime/values';
import { listen, optionalCount, settled, type MultiplayerApiContext } from './multiplayer-context';
import { createLobbyApi } from './multiplayer-lobby';
import { createMatchmakingApi } from './multiplayer-matchmaking';
import { createObjectsApi } from './multiplayer-objects';
import { createRpcBridge } from './multiplayer-rpc';
interface PhaseChange {
    readonly phase: SessionPhase;
    readonly reason: string;
}
interface PlayerExit {
    readonly player: SessionPlayer;
    readonly reason: string;
}
const API = 'helix.multiplayer';
const DEFAULT_KICK_REASON = 'removido pelo anfitrião';
export function createMultiplayerApi(host: RuntimeHost) {
    const runtime = host.multiplayer;
    const context: MultiplayerApiContext = { host, runtime };
    const rpc = createRpcBridge(context);
    const objects = createObjectsApi(context, rpc.bridge);
    const rotation = quat.create();
    const describePlayer = (player: SessionPlayer) => ({ id: player.id, name: player.name, local: player.id === runtime.localPlayerId });
    const onPhase = (phase: SessionPhase, handler: unknown, member: string, deliver: (change: PhaseChange) => unknown[]) => listen<PhaseChange>(host, MULTIPLAYER_EVENT.phase, handler, member, (change) => (change.phase === phase ? deliver(change) : null));
    return {
        get enabled() {
            return runtime.isActive;
        },
        get phase() {
            return runtime.phase;
        },
        get connected() {
            return runtime.phase === 'connected';
        },
        get isHost() {
            return runtime.isHost;
        },
        get hosted() {
            return runtime.link?.kind === 'hosted';
        },
        get sessionId() {
            return runtime.sessionId;
        },
        get joinCode() {
            return runtime.joinCode;
        },
        get localPlayer() {
            const local = runtime.players.find((player) => player.id === runtime.localPlayerId);
            return local ? describePlayer(local) : null;
        },
        get playerName() {
            return runtime.playerName;
        },
        set playerName(name: string) {
            runtime.playerName = requireString(name, `${API}.playerName`, 'o nome do jogador');
        },
        get ping() {
            return runtime.stats?.roundTripMs ?? 0;
        },
        players: () => runtime.players.map(describePlayer),
        stats: () => {
            const stats = runtime.stats;
            return stats
                ? { ping: stats.roundTripMs, jitter: stats.jitterMs, loss: stats.lossRate, bytesSentPerSecond: stats.bytesSentPerSecond, bytesReceivedPerSecond: stats.bytesReceivedPerSecond, packetsSentPerSecond: stats.packetsSentPerSecond, packetsReceivedPerSecond: stats.packetsReceivedPerSecond, backlogBytes: stats.backlogBytes, resentFrames: stats.resentFrames }
                : null;
        },
        join: (sessionId?: unknown) => runtime.joinSession(sessionId === undefined ? (runtime.blueprint?.settings.defaultSession ?? '') : requireString(sessionId, `${API}.join`, 'o nome da sessão')),
        joinByCode: (code: unknown) => runtime.joinByCode(requireString(code, `${API}.joinByCode`, 'o código da sessão')),
        host: (options?: unknown) => settled(`${API}.host`, () => runtime.hostSession(options === undefined ? undefined : optionalCount(requireObject(options, `${API}.host`).maxPlayers, `${API}.host`, 'o máximo de jogadores'))),
        leave: () => runtime.leave(),
        kick: (playerId: unknown, reason?: unknown) => runtime.objects?.kick(requireNumber(playerId, `${API}.kick`, 'o id do jogador'), reason === undefined ? DEFAULT_KICK_REASON : requireString(reason, `${API}.kick`, 'o motivo')) ?? false,
        onConnected: (handler: unknown) => onPhase('connected', handler, `${API}.onConnected`, (change) => [{ sessionId: runtime.sessionId, playerId: runtime.localPlayerId, resumed: change.reason !== '' }]),
        onDisconnected: (handler: unknown) => onPhase('offline', handler, `${API}.onDisconnected`, (change) => [change.reason, describeDisconnect(change.reason)]),
        onReconnecting: (handler: unknown) => onPhase('reconnecting', handler, `${API}.onReconnecting`, (change) => [Number(change.reason)]),
        onPlayerJoined: (handler: unknown) => listen<SessionPlayer>(host, MULTIPLAYER_EVENT.playerJoined, handler, `${API}.onPlayerJoined`, (player) => [describePlayer(player)]),
        onPlayerLeft: (handler: unknown) => listen<PlayerExit>(host, MULTIPLAYER_EVENT.playerLeft, handler, `${API}.onPlayerLeft`, ({ player, reason }) => [describePlayer(player), reason]),
        object: objects.ofActor,
        objects: objects.api,
        spawn: (template: unknown, options?: unknown) => {
            const entity = requireEntity(template, `${API}.spawn`, 'o modelo');
            const record = options === undefined ? {} : requireObject(options, `${API}.spawn`);
            const transform = readEntityTransform(entity, createTransformState());
            if (record.position !== undefined) {
                const position = toVec3(record.position, `${API}.spawn`);
                for (let axis = 0; axis < 3; axis++)
                    transform.position[axis] = position[axis];
            }
            if (record.rotation !== undefined) {
                quat.fromEulerDegrees(rotation, toVec3(record.rotation, `${API}.spawn`));
                for (let component = 0; component < 4; component++)
                    transform.rotation[component] = rotation[component];
            }
            return runtime.objects?.spawn(entity, { ownerId: optionalNumber(record.owner, 0, `${API}.spawn`, 'o dono'), transform }) ?? null;
        },
        despawn: (objectId: unknown) => runtime.objects?.despawn(requireNumber(objectId, `${API}.despawn`, 'o id do objeto')) ?? false,
        rpc: rpc.api,
        lobby: createLobbyApi(context),
        matchmaking: createMatchmakingApi(context),
    };
}
