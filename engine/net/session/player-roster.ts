import type { ServerPeer } from './server-peer';
import type { SessionPlayer } from './session-protocol';
interface SuspendedPlayer {
    readonly player: SessionPlayer;
    readonly expiresAt: number;
}
export class PlayerRoster {
    private readonly players = new Map<number, SessionPlayer>();
    private readonly active = new Map<number, ServerPeer>();
    private readonly suspended = new Map<string, SuspendedPlayer>();
    private nextId = 1;
    get size(): number {
        return this.players.size;
    }
    get all(): SessionPlayer[] {
        return Array.from(this.players.values());
    }
    activePeers(): IterableIterator<ServerPeer> {
        return this.active.values();
    }
    peerOf(playerId: number): ServerPeer | undefined {
        return this.active.get(playerId);
    }
    allocateId(): number {
        return this.nextId++;
    }
    activate(peer: ServerPeer, player: SessionPlayer): void {
        this.players.set(player.id, player);
        this.active.set(player.id, peer);
    }
    deactivate(peer: ServerPeer): SessionPlayer | null {
        const { player } = peer;
        if (!player || this.active.get(player.id) !== peer)
            return null;
        this.active.delete(player.id);
        return player;
    }
    suspend(token: string, player: SessionPlayer, expiresAt: number): void {
        this.suspended.set(token, { player, expiresAt });
    }
    takeSuspended(token: string): SessionPlayer | null {
        const entry = this.suspended.get(token);
        if (!entry)
            return null;
        this.suspended.delete(token);
        return entry.player;
    }
    takeSuspendedPlayer(playerId: number): SessionPlayer | null {
        for (const [token, { player }] of this.suspended) {
            if (player.id !== playerId)
                continue;
            this.suspended.delete(token);
            return player;
        }
        return null;
    }
    takeExpired(now: number): SessionPlayer[] {
        const expired: SessionPlayer[] = [];
        for (const [token, { player, expiresAt }] of this.suspended) {
            if (now < expiresAt)
                continue;
            this.suspended.delete(token);
            expired.push(player);
        }
        return expired;
    }
    activePeerWithToken(token: string): ServerPeer | null {
        for (const peer of this.active.values())
            if (peer.resumeToken === token)
                return peer;
        return null;
    }
    remove(playerId: number): boolean {
        return this.players.delete(playerId);
    }
    clear(): void {
        this.players.clear();
        this.active.clear();
        this.suspended.clear();
    }
}
