import { DISCONNECT } from './disconnect-reason';
import { BufferedSocket } from './packet-socket';
export const WEBSOCKET_MAX_PACKET_BYTES = 16 * 1024;
const NORMAL_CLOSURE = 1000;
const MAX_CLOSE_REASON_LENGTH = 120;
export class WebSocketPacketSocket extends BufferedSocket {
    readonly maxPacketBytes = WEBSOCKET_MAX_PACKET_BYTES;
    private readonly socket: WebSocket;
    constructor(url: string) {
        super();
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';
        this.socket.addEventListener('open', () => this.markOpen());
        this.socket.addEventListener('message', (event: MessageEvent<unknown>) => this.accept(event.data));
        this.socket.addEventListener('close', (event) => this.markClosed(event.reason || (this.state === 'connecting' ? DISCONNECT.unreachable : DISCONNECT.shutdown)));
    }
    send(packet: Uint8Array): void {
        if (this.state === 'open')
            this.socket.send(packet);
    }
    close(reason: string): void {
        if (this.state === 'closed')
            return;
        this.markClosed(reason);
        this.socket.close(NORMAL_CLOSURE, reason.slice(0, MAX_CLOSE_REASON_LENGTH));
    }
    private accept(payload: unknown): void {
        if (payload instanceof ArrayBuffer)
            this.deliver(new Uint8Array(payload));
        else
            this.close(DISCONNECT.protocol);
    }
}
