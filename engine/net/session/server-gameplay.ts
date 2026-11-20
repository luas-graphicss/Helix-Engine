import { decodeInputBatch, decodeVariableSet } from '../objects/object-codec';
import type { ObjectRegistry } from '../objects/object-registry';
import type { RpcMessage } from '../rpc/rpc-codec';
import type { RpcTable } from '../rpc/rpc-table';
import type { ByteReader } from '../wire/byte-reader';
import { WireError } from '../wire/wire-error';
import type { ServerPeer } from './server-peer';
import type { NetServerListener } from './server-types';
import type { SessionPlayer } from './session-protocol';
const REFUSED_RPC_WEIGHT = 2;
const THROTTLED_RPC_WEIGHT = 1;
export type ViolationReporter = (peer: ServerPeer, weight: number, nowMs: number) => void;
export class ServerGameplay {
    constructor(private readonly objects: ObjectRegistry, private readonly rpc: RpcTable, private readonly listener: NetServerListener, private readonly violate: ViolationReporter) { }
    handleRpc(peer: ServerPeer, player: SessionPlayer, message: RpcMessage, receivedAt: number): void {
        const name = peer.inboundNames.nameOf(message.nameId);
        if (name === undefined)
            return;
        const entry = this.rpc.get(name);
        if (!entry) {
            this.violate(peer, REFUSED_RPC_WEIGHT, receivedAt);
            return;
        }
        if (message.objectId !== 0) {
            const object = this.objects.get(message.objectId);
            if (!object || !peer.visible.has(message.objectId))
                return;
            if (entry.rules.requireOwnership && object.ownerId !== player.id) {
                this.violate(peer, REFUSED_RPC_WEIGHT, receivedAt);
                return;
            }
        }
        if (entry.rules.perSecond > 0 && !peer.rpcBucket(name, entry.rules.perSecond).tryTake(receivedAt)) {
            this.violate(peer, THROTTLED_RPC_WEIGHT, receivedAt);
            return;
        }
        entry.handler({ senderId: player.id, objectId: message.objectId }, message.args);
    }
    handleVariable(player: SessionPlayer, reader: ByteReader): void {
        const { objectId, change } = decodeVariableSet(reader);
        const object = this.objects.get(objectId);
        if (!object)
            return;
        if (object.ownerId !== player.id || object.variables.writerOf(change.index) !== 'owner')
            throw new WireError(`variable ${change.index} of object ${objectId} is not writable by player ${player.id}`);
        object.variables.apply(change.index, change.value);
        object.variables.markDirty(change.index);
    }
    handleInputs(peer: ServerPeer, player: SessionPlayer, reader: ByteReader): void {
        const batch = decodeInputBatch(reader);
        const object = this.objects.get(batch.objectId);
        if (!object || object.ownerId !== player.id)
            return;
        for (const entry of batch.entries.toSorted((a, b) => a.tick - b.tick)) {
            if (entry.tick <= (peer.inputTicks.get(object.id) ?? -1))
                continue;
            peer.inputTicks.set(object.id, entry.tick);
            this.listener.inputReceived(player, object, entry.tick, entry.input);
        }
    }
    handleOwnershipRequest(peer: ServerPeer, player: SessionPlayer, objectId: number): void {
        const object = this.objects.get(objectId);
        if (object && peer.visible.has(objectId) && object.ownerId !== player.id && this.listener.ownershipRequested(player, object))
            this.objects.setOwner(objectId, player.id);
    }
}
