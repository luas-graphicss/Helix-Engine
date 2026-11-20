import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { History } from '@/engine/editor/history/history';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { NetworkSection } from '@/engine/editor/panels/inspector/network/network-section';
import { MultiplayerPanel } from '@/engine/editor/panels/multiplayer-panel';
import { ObjectsView } from '@/engine/editor/panels/multiplayer/objects/objects-view';
import { RpcsView } from '@/engine/editor/panels/multiplayer/rpcs/rpcs-view';
import { ServerView } from '@/engine/editor/panels/multiplayer/server/server-view';
import { ServicesView } from '@/engine/editor/panels/multiplayer/services/services-view';
import { ToolsView } from '@/engine/editor/panels/multiplayer/tools/tools-view';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { EditorSessionProvider } from '@/engine/editor/session/editor-session-context';
import { MultiplayerRuntime } from '@/engine/net/runtime/multiplayer-runtime';
export interface PanelStage {
    readonly scene: Scene;
    readonly history: History;
    readonly session: EditorSession;
    select(entity: Entity | null): void;
}
export const IDLE_STATUS: MultiplayerStatus = { playing: false, active: false, phase: 'offline', linkKind: null, isHost: false, sessionId: '', joinCode: '', localPlayerId: 0, players: [], objects: 0, testClients: 0, stats: null, server: null };
export const LIVE_STATUS: MultiplayerStatus = {
    playing: true,
    active: true,
    phase: 'connected',
    linkKind: 'local',
    isHost: true,
    sessionId: 'principal',
    joinCode: 'AB12CD',
    localPlayerId: 1,
    players: [
        { id: 1, name: 'Ana' },
        { id: 2, name: 'Teste 1' },
    ],
    objects: 3,
    testClients: 1,
    stats: { roundTripMs: 42, jitterMs: 3, lossRate: 0.004, bytesSentPerSecond: 2300, bytesReceivedPerSecond: 3100, packetsSentPerSecond: 30, packetsReceivedPerSecond: 30, totalBytesSent: 120000, totalBytesReceived: 180000, backlogBytes: 0, resentFrames: 2 },
    server: { uptimeMs: 65000, players: 2, sessions: [{ id: 'principal', players: 2, maxPlayers: 16, objects: 3, tick: 1950 }], lobbies: 1, searching: 0, relayRooms: 0, relayConnections: 0, serviceMembers: 2 },
};
function createIdleRuntime(scene: Scene): MultiplayerRuntime {
    return new MultiplayerRuntime({
        scene,
        entitySpawned: () => undefined,
        entityRemoved: () => undefined,
        log: () => undefined,
    }, {
        phaseChanged: () => undefined,
        playerJoined: () => undefined,
        playerLeft: () => undefined,
        objectBound: () => undefined,
        objectUnbound: () => undefined,
        objectCorrected: () => undefined,
        ownerChanged: () => undefined,
    });
}
export function createPanelStage(): PanelStage {
    const scene = new Scene();
    const history = new History(() => undefined);
    let selected: Entity | null = null;
    const select = (entity: Entity | null): void => {
        selected = entity;
    };
    const stub = {
        scene,
        history,
        scripts: { running: false, mode: 'play', multiplayer: createIdleRuntime(scene) },
        get selectedEntity() {
            return selected;
        },
        select,
        notify: () => undefined,
        subscribeTopic: () => () => undefined,
        getTopicVersion: () => 0,
    };
    return { scene, history, session: stub as unknown as EditorSession, select };
}
function render(stage: PanelStage, node: ReactNode): string {
    return renderToStaticMarkup(<EditorSessionProvider session={stage.session}>{node}</EditorSessionProvider>);
}
export function renderPanel(stage: PanelStage): string {
    return render(stage, <MultiplayerPanel />);
}
export function renderServices(stage: PanelStage): string {
    return render(stage, <ServicesView />);
}
export function renderObjects(stage: PanelStage): string {
    return render(stage, <ObjectsView />);
}
export function renderRpcs(stage: PanelStage): string {
    return render(stage, <RpcsView />);
}
export function renderServer(stage: PanelStage, status: MultiplayerStatus): string {
    return render(stage, <ServerView status={status}/>);
}
export function renderTools(stage: PanelStage, status: MultiplayerStatus): string {
    return render(stage, <ToolsView status={status}/>);
}
export function renderInspector(stage: PanelStage, entity: Entity): string {
    return render(stage, <NetworkSection entity={entity}/>);
}
