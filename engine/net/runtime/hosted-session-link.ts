import type { TextChannel } from '../services/text-channel';
import { SERVICES_ROUTE, multiplayerUrl } from '../transport/multiplayer-address';
import type { PacketSocket } from '../transport/packet-socket';
import { WebSocketPacketSocket } from '../transport/websocket-socket';
import { WebSocketTextChannel } from '../transport/websocket-text-channel';
import type { SessionLink } from './session-link';
export class HostedSessionLink implements SessionLink {
    readonly kind = 'hosted';
    constructor(readonly serverUrl: string) { }
    now(): number {
        return performance.now();
    }
    openSocket(path: string): PacketSocket {
        return new WebSocketPacketSocket(multiplayerUrl(this.serverUrl, path));
    }
    openServices(): TextChannel {
        return new WebSocketTextChannel(multiplayerUrl(this.serverUrl, SERVICES_ROUTE));
    }
    advance(): void { }
    close(): void { }
}
