import { planDeliveries, type NetworkConditions } from './network-conditions';
import { BufferedSocket, type PacketSocket } from './packet-socket';
export class ConditionedSocket extends BufferedSocket {
    readonly maxPacketBytes: number;
    conditions: NetworkConditions;
    constructor(private readonly inner: PacketSocket, conditions: NetworkConditions, private readonly random: () => number = Math.random) {
        super();
        this.maxPacketBytes = inner.maxPacketBytes;
        this.conditions = conditions;
        inner.attach({
            opened: () => this.markOpen(),
            received: (packet) => this.defer(packet, (delayed) => this.deliver(delayed)),
            closed: (reason) => this.markClosed(reason),
        });
    }
    send(packet: Uint8Array): void {
        this.defer(packet.slice(), (delayed) => this.inner.send(delayed));
    }
    close(reason: string): void {
        this.inner.close(reason);
        this.markClosed(reason);
    }
    private defer(packet: Uint8Array, forward: (packet: Uint8Array) => void): void {
        for (const delay of planDeliveries(this.conditions, this.random)) {
            if (delay <= 0)
                forward(packet);
            else
                setTimeout(() => forward(packet), delay);
        }
    }
}
