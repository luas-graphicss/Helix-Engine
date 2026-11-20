import type { Entity } from '@/engine/core/scene/entity';
import type { NetworkObject } from '../objects/network-object';
import type { SessionPlayer } from '../session/session-protocol';
export type SessionPhase = 'offline' | 'connecting' | 'connected' | 'reconnecting';
export interface BoundObject {
    readonly objectId: number;
    readonly entity: Entity;
    readonly isCopy: boolean;
    object: NetworkObject;
}
export interface BindingListener {
    objectBound(binding: BoundObject): void;
    objectUnbound(binding: BoundObject): void;
}
export interface RuntimeListener extends BindingListener {
    phaseChanged(phase: SessionPhase, reason: string): void;
    playerJoined(player: SessionPlayer): void;
    playerLeft(player: SessionPlayer, reason: string): void;
    objectCorrected(binding: BoundObject): void;
    ownerChanged(binding: BoundObject, previousOwnerId: number): void;
}
