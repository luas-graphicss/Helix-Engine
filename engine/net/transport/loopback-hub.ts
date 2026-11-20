import { DISCONNECT } from './disconnect-reason';
import { PERFECT_CONDITIONS, planDeliveries, type NetworkConditions } from './network-conditions';
import { BufferedSocket, type SocketAcceptor } from './packet-socket';
const LOOPBACK_MAX_PACKET_BYTES = 1200;
const PATH_SEPARATOR = '/';
interface ScheduledDelivery {
    readonly dueAt: number;
    readonly order: number;
    readonly run: () => void;
}
export class LoopbackSocket extends BufferedSocket {
    readonly maxPacketBytes = LOOPBACK_MAX_PACKET_BYTES;
    private peer: LoopbackSocket | null = null;
    private conditions: NetworkConditions;
    constructor(private readonly hub: LoopbackHub, conditions: NetworkConditions) {
        super();
        this.conditions = conditions;
    }
    link(peer: LoopbackSocket): void {
        this.peer = peer;
        peer.peer = this;
    }
    open(): void {
        this.markOpen();
    }
    setConditions(conditions: NetworkConditions): void {
        this.conditions = conditions;
        if (this.peer)
            this.peer.conditions = conditions;
    }
    send(packet: Uint8Array): void {
        const peer = this.peer;
        if (this.state !== 'open' || !peer)
            return;
        const copy = packet.slice();
        for (const delay of planDeliveries(this.conditions, this.hub.random))
            this.hub.schedule(delay, () => peer.deliver(copy));
    }
    close(reason: string): void {
        if (this.state === 'closed')
            return;
        const peer = this.peer;
        this.peer = null;
        this.markClosed(reason);
        if (!peer)
            return;
        peer.peer = null;
        this.hub.schedule(this.conditions.latencyMs, () => peer.markClosed(reason));
    }
}
export class LoopbackHub {
    private now = 0;
    private order = 0;
    private readonly scheduled: ScheduledDelivery[] = [];
    private readonly acceptors = new Map<string, SocketAcceptor>();
    constructor(readonly random: () => number = Math.random) { }
    get timeMs(): number {
        return this.now;
    }
    listen(service: string, accept: SocketAcceptor): () => void {
        this.acceptors.set(service, accept);
        return () => {
            if (this.acceptors.get(service) === accept)
                this.acceptors.delete(service);
        };
    }
    connect(address: string, conditions: NetworkConditions = PERFECT_CONDITIONS): LoopbackSocket {
        const client = new LoopbackSocket(this, conditions);
        const server = new LoopbackSocket(this, conditions);
        const separator = address.indexOf(PATH_SEPARATOR);
        const service = separator < 0 ? address : address.slice(0, separator);
        const path = separator < 0 ? '' : address.slice(separator + 1);
        this.schedule(conditions.latencyMs, () => {
            const accept = this.acceptors.get(service);
            if (!accept) {
                client.close(DISCONNECT.unreachable);
                return;
            }
            client.link(server);
            server.open();
            client.open();
            accept(server, path);
        });
        return client;
    }
    schedule(delayMs: number, run: () => void): void {
        const entry: ScheduledDelivery = { dueAt: this.now + Math.max(0, delayMs), order: this.order++, run };
        let low = 0;
        let high = this.scheduled.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (this.scheduled[middle].dueAt <= entry.dueAt)
                low = middle + 1;
            else
                high = middle;
        }
        this.scheduled.splice(low, 0, entry);
    }
    advance(elapsedMs: number): void {
        const target = this.now + Math.max(0, elapsedMs);
        for (let next = this.scheduled[0]; next && next.dueAt <= target; next = this.scheduled[0]) {
            this.scheduled.shift();
            this.now = next.dueAt;
            next.run();
        }
        this.now = target;
    }
}
