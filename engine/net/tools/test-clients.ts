import { createSessionClient } from '../runtime/session-connector';
import type { SessionLink } from '../runtime/session-link';
import type { NetClientListener } from '../session/client-types';
import type { NetClient } from '../session/net-client';
import { cloneTransformState, copyTransformState, createTransformState, type TransformState } from '../sync/transform-state';
interface TestClient {
    readonly client: NetClient;
    readonly phase: number;
    readonly anchors: Map<number, TransformState>;
}
export const MAX_TEST_CLIENTS = 8;
const ORBIT_RADIUS = 2.5;
const ORBIT_RADIANS_PER_SECOND = 0.9;
const PHASE_STEP_RADIANS = (Math.PI * 2) / MAX_TEST_CLIENTS;
const SILENT_LISTENER: NetClientListener = {
    connected: () => undefined,
    reconnecting: () => undefined,
    disconnected: () => undefined,
    playerJoined: () => undefined,
    playerLeft: () => undefined,
    corrected: () => undefined,
};
export class TestClients {
    private readonly clients: TestClient[] = [];
    private readonly pose = createTransformState();
    private elapsedSeconds = 0;
    private nextNumber = 1;
    constructor(private readonly link: SessionLink, private readonly schema: string) { }
    get count(): number {
        return this.clients.length;
    }
    add(path: string): boolean {
        if (!path || this.clients.length >= MAX_TEST_CLIENTS)
            return false;
        const client = createSessionClient(this.link, this.schema, () => this.link.openSocket(path), { name: `Teste ${this.nextNumber++}`, ticket: null }, SILENT_LISTENER);
        this.clients.push({ client, phase: this.clients.length * PHASE_STEP_RADIANS, anchors: new Map() });
        client.start();
        return true;
    }
    remove(): boolean {
        const last = this.clients.pop();
        last?.client.leave();
        return last !== undefined;
    }
    update(elapsedMs: number): void {
        this.elapsedSeconds += elapsedMs / 1000;
        for (const entry of this.clients) {
            entry.client.update();
            if (entry.client.phase === 'connected')
                this.wander(entry);
        }
    }
    clear(): void {
        for (const { client } of this.clients.splice(0))
            client.leave();
    }
    private wander({ client, phase, anchors }: TestClient): void {
        const angle = this.elapsedSeconds * ORBIT_RADIANS_PER_SECOND + phase;
        for (const object of client.objects.ownedBy(client.localId)) {
            if (!object.isSimulatedBy(client.localId))
                continue;
            let anchor = anchors.get(object.id);
            if (!anchor) {
                anchor = cloneTransformState(object.transform);
                anchors.set(object.id, anchor);
            }
            copyTransformState(this.pose, anchor);
            this.pose.position[0] += Math.cos(angle) * ORBIT_RADIUS;
            this.pose.position[2] += Math.sin(angle) * ORBIT_RADIUS;
            client.publishTransform(object.id, this.pose);
        }
    }
}
