import { MultiplayerRuntime, type MultiplayerEnvironment } from '@/engine/net/runtime/multiplayer-runtime';
import type { RuntimeListener } from '@/engine/net/runtime/runtime-events';
import { createSessionBlueprint } from '@/engine/net/runtime/session-blueprint';
import { describeDisconnect, DISCONNECT } from '@/engine/net/transport/disconnect-reason';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import type { RuntimeHost } from './runtime-host';
import { readSimulatedConditions } from './simulated-conditions';
import { parseTestTicket } from './test-ticket';
export type MultiplayerBridgeHost = Pick<RuntimeHost, 'session' | 'bus' | 'trackSpawned' | 'destroyScriptsOf' | 'requestActorSync' | 'log'>;
export const MULTIPLAYER_EVENT = {
    phase: 'multiplayer.phase',
    playerJoined: 'multiplayer.player.joined',
    playerLeft: 'multiplayer.player.left',
    objectSpawned: 'multiplayer.object.spawned',
    objectDespawned: 'multiplayer.object.despawned',
    objectCorrected: 'multiplayer.object.corrected',
    ownerChanged: 'multiplayer.object.owner',
} as const;
const LOG_SOURCE = 'Multiplayer';
const DEFAULT_PLAYER_NAME = 'Jogador';
export function createMultiplayerRuntime(host: MultiplayerBridgeHost): MultiplayerRuntime {
    const emit = (event: string, payload: unknown): void => void host.bus.emit(event, payload);
    const log: MultiplayerEnvironment['log'] = (level, message) => host.log(level, message, { source: LOG_SOURCE });
    const environment: MultiplayerEnvironment = {
        get scene() {
            return host.session.scene;
        },
        entitySpawned: (entity) => {
            host.trackSpawned(entity);
            host.requestActorSync();
        },
        entityRemoved: (entity) => {
            const { session } = host;
            if (session.selectedEntity && entity.contains(session.selectedEntity))
                session.select(null);
            host.destroyScriptsOf(entity);
            entity.parent?.remove(entity);
            host.requestActorSync();
        },
        log,
    };
    const listener: RuntimeListener = {
        phaseChanged: (phase, reason) => {
            if (phase === 'connected')
                log('info', `Conectado à sessão "${runtime.sessionId}" como jogador ${runtime.localPlayerId}${reason ? ' · sessão retomada' : ''}.`);
            else if (phase === 'reconnecting')
                log('warn', `Ligação com a sessão perdida; tentativa ${reason} de reconectar.`);
            else if (phase === 'offline' && reason !== DISCONNECT.left)
                log('warn', `Fora da sessão: ${describeDisconnect(reason)}.`);
            emit(MULTIPLAYER_EVENT.phase, { phase, reason });
        },
        playerJoined: (player) => emit(MULTIPLAYER_EVENT.playerJoined, player),
        playerLeft: (player, reason) => emit(MULTIPLAYER_EVENT.playerLeft, { player, reason }),
        objectBound: (binding) => emit(MULTIPLAYER_EVENT.objectSpawned, binding),
        objectUnbound: (binding) => emit(MULTIPLAYER_EVENT.objectDespawned, binding),
        objectCorrected: (binding) => emit(MULTIPLAYER_EVENT.objectCorrected, binding),
        ownerChanged: (binding, previousOwnerId) => emit(MULTIPLAYER_EVENT.ownerChanged, { binding, previousOwnerId }),
    };
    const runtime: MultiplayerRuntime = new MultiplayerRuntime(environment, listener);
    return runtime;
}
export function startMultiplayer(runtime: MultiplayerRuntime, session: EditorSession): void {
    const { scene } = session;
    if (!scene.multiplayer.enabled)
        return;
    const { server } = scene.scripting;
    const blueprint = createSessionBlueprint(scene, { tickRate: server.tickRate, maxPlayers: server.maxPlayers });
    for (const name of blueprint.plan.outOfRange)
        session.log.warn(LOG_SOURCE, `${name} ficou fora da rede: a cena tem atores demais para ele receber um id de objeto de rede.`);
    const hosted = engineSettings.get('simulation.net.server') === 'hosted' && server.url !== '';
    runtime.start({
        blueprint,
        serverUrl: hosted ? server.url : null,
        conditions: readSimulatedConditions(),
        identity: { name: DEFAULT_PLAYER_NAME, ticket: parseTestTicket(engineSettings.get('simulation.net.ticket')) },
    });
    const { plan } = blueprint;
    session.log.info(LOG_SOURCE, `${hosted ? `Servidor hospedado em ${server.url}` : 'Servidor simulado no editor'} · ${plan.sceneObjects.length} objetos da cena, ${plan.playerTemplates.length} por jogador, ${plan.spawnTemplates.length} modelos · esquema ${plan.schema}.`);
}
