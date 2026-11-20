import { DISCONNECT, disconnectReason } from '../../transport/disconnect-reason';
import type { PacketSocket } from '../../transport/packet-socket';
import { WireError } from '../../wire/wire-error';
import type { RelayDirectory } from './relay-directory';
import { RELAY_FRAME_OVERHEAD_BYTES, decodeRelayFrame, encodeRelayClosed, encodeRelayData, encodeRelayOpened } from './relay-protocol';
interface RelayRoom {
    readonly code: string;
    readonly host: PacketSocket;
    readonly clients: Map<number, PacketSocket>;
    readonly maxConnections: number;
    nextConnectionId: number;
    malformed: number;
}
const CONNECTION_ID_RANGE = 0x10000;
const MAX_MALFORMED_FRAMES = 8;
const REJECTED_UNKNOWN = disconnectReason(DISCONNECT.rejected, 'relay');
const REJECTED_FULL = disconnectReason(DISCONNECT.rejected, 'full');
export class RelayHub {
    private readonly rooms = new Map<string, RelayRoom>();
    constructor(private readonly directory: RelayDirectory) { }
    get roomCount(): number {
        return this.rooms.size;
    }
    get connectionCount(): number {
        let count = 0;
        for (const room of this.rooms.values())
            count += room.clients.size;
        return count;
    }
    connectHost(code: string, socket: PacketSocket): void {
        const allocation = this.directory.find(code);
        if (!allocation || this.rooms.has(allocation.code)) {
            socket.close(REJECTED_UNKNOWN);
            return;
        }
        allocation.claimed = true;
        const room: RelayRoom = { code: allocation.code, host: socket, clients: new Map(), maxConnections: allocation.maxConnections, nextConnectionId: 1, malformed: 0 };
        this.rooms.set(room.code, room);
        socket.attach({
            opened: () => undefined,
            received: (packet) => this.forwardFromHost(room, packet),
            closed: () => this.closeRoom(room),
        });
    }
    connectClient(code: string, socket: PacketSocket): void {
        const room = this.rooms.get(this.directory.find(code)?.code ?? '');
        if (!room) {
            socket.close(REJECTED_UNKNOWN);
            return;
        }
        if (room.clients.size >= room.maxConnections) {
            socket.close(REJECTED_FULL);
            return;
        }
        const connectionId = this.claimConnectionId(room);
        room.clients.set(connectionId, socket);
        room.host.send(encodeRelayOpened(connectionId));
        socket.attach({
            opened: () => undefined,
            received: (packet) => {
                if (packet.length + RELAY_FRAME_OVERHEAD_BYTES <= room.host.maxPacketBytes)
                    room.host.send(encodeRelayData(connectionId, packet));
            },
            closed: (reason) => {
                if (room.clients.get(connectionId) !== socket)
                    return;
                room.clients.delete(connectionId);
                room.host.send(encodeRelayClosed(connectionId, reason));
            },
        });
    }
    close(): void {
        for (const room of Array.from(this.rooms.values())) {
            room.host.close(DISCONNECT.shutdown);
            this.closeRoom(room);
        }
    }
    private claimConnectionId(room: RelayRoom): number {
        while (room.clients.has(room.nextConnectionId))
            room.nextConnectionId = (room.nextConnectionId + 1) % CONNECTION_ID_RANGE;
        const connectionId = room.nextConnectionId;
        room.nextConnectionId = (connectionId + 1) % CONNECTION_ID_RANGE;
        return connectionId;
    }
    private forwardFromHost(room: RelayRoom, packet: Uint8Array): void {
        try {
            const frame = decodeRelayFrame(packet);
            const client = room.clients.get(frame.connectionId);
            if (!client)
                return;
            if (frame.kind === 'data')
                client.send(frame.payload);
            else if (frame.kind === 'closed') {
                room.clients.delete(frame.connectionId);
                client.close(frame.reason);
            }
        }
        catch (error) {
            if (!(error instanceof WireError))
                throw error;
            room.malformed++;
            if (room.malformed > MAX_MALFORMED_FRAMES)
                room.host.close(DISCONNECT.protocol);
        }
    }
    private closeRoom(room: RelayRoom): void {
        if (this.rooms.get(room.code) !== room)
            return;
        this.rooms.delete(room.code);
        this.directory.release(room.code);
        for (const client of room.clients.values())
            client.close(DISCONNECT.hostLeft);
        room.clients.clear();
    }
}
