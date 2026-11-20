import * as quat from '@/engine/core/math/quat';
import type { BoundObject } from '@/engine/net/runtime/runtime-events';
import { readEntityTransform } from '@/engine/net/scene/entity-transform';
import { createTransformState } from '@/engine/net/sync/transform-state';
import { MULTIPLAYER_EVENT } from '../../runtime/multiplayer-bridge';
import { requireEntity, requireNumber, requireString, toVec3 } from '../../runtime/values';
import { listen, requireNetValue, type MultiplayerApiContext } from './multiplayer-context';
import type { RpcBridge } from './multiplayer-rpc';
import { VariableWatches } from './variable-watches';
interface OwnerChange {
    readonly binding: BoundObject;
    readonly previousOwnerId: number;
}
const SERVER_OWNER_ID = 0;
const HANDLE = 'helix.multiplayer objeto';
export type NetworkObjectHandle = ReturnType<ReturnType<typeof createObjectHandles>>;
export function createObjectHandles({ host, runtime }: MultiplayerApiContext, rpc: RpcBridge) {
    const watches = new VariableWatches(host, runtime);
    const rotation = quat.create();
    return (binding: BoundObject) => ({
        get id() {
            return binding.objectId;
        },
        get kind() {
            return binding.object.kind;
        },
        get actor() {
            return binding.entity;
        },
        get ownerId() {
            return binding.object.ownerId;
        },
        get authority() {
            return binding.object.authority;
        },
        get isCopy() {
            return binding.isCopy;
        },
        get isMine() {
            return runtime.phase === 'connected' && binding.object.ownerId === runtime.localPlayerId;
        },
        get isServerOwned() {
            return binding.object.ownerId === SERVER_OWNER_ID;
        },
        get: (name: unknown) => binding.object.variables.get(requireString(name, `${HANDLE}.get`, 'o nome da variável')) ?? null,
        set: (name: unknown, value: unknown) => runtime.objects?.setVariable(binding.objectId, requireString(name, `${HANDLE}.set`, 'o nome da variável'), requireNetValue(value, `${HANDLE}.set`, 'o valor')) ?? false,
        watch: (name: unknown, handler: unknown) => watches.add(binding.objectId, requireString(name, `${HANDLE}.watch`, 'o nome da variável'), handler, `${HANDLE}.watch`),
        requestOwnership: () => runtime.objects?.requestOwnership(binding.objectId) ?? false,
        setOwner: (playerId: unknown) => runtime.objects?.setOwner(binding.objectId, requireNumber(playerId, `${HANDLE}.setOwner`, 'o id do jogador')) ?? false,
        teleport: (position: unknown, eulerDegrees?: unknown) => {
            const transform = readEntityTransform(binding.entity, createTransformState());
            const target = toVec3(position, `${HANDLE}.teleport`);
            for (let axis = 0; axis < 3; axis++)
                transform.position[axis] = target[axis];
            if (eulerDegrees !== undefined) {
                quat.fromEulerDegrees(rotation, toVec3(eulerDegrees, `${HANDLE}.teleport`));
                for (let component = 0; component < 4; component++)
                    transform.rotation[component] = rotation[component];
            }
            return runtime.objects?.teleport(binding.objectId, transform) ?? false;
        },
        despawn: () => runtime.objects?.despawn(binding.objectId) ?? false,
        send: (name: unknown, ...args: unknown[]) => rpc.send(name, args, `${HANDLE}.send`, binding.objectId, true),
        on: (name: unknown, handler: unknown) => rpc.listenClient(name, handler, `${HANDLE}.on`, binding.objectId),
    });
}
export function createObjectsApi(context: MultiplayerApiContext, rpc: RpcBridge) {
    const { host, runtime } = context;
    const handleOf = createObjectHandles(context, rpc);
    const find = (objectId: unknown) => {
        const binding = runtime.binding?.ofObject(requireNumber(objectId, 'helix.multiplayer.objects.find', 'o id do objeto'));
        return binding ? handleOf(binding) : null;
    };
    const ofActor = (actor: unknown) => {
        const binding = runtime.binding?.ofEntity(requireEntity(actor, 'helix.multiplayer.object'));
        return binding ? handleOf(binding) : null;
    };
    const api = {
        list: () => (runtime.binding?.all() ?? []).map(handleOf),
        find,
        onSpawned: (handler: unknown) => listen<BoundObject>(host, MULTIPLAYER_EVENT.objectSpawned, handler, 'helix.multiplayer.objects.onSpawned', (binding) => [handleOf(binding)]),
        onDespawned: (handler: unknown) => listen<BoundObject>(host, MULTIPLAYER_EVENT.objectDespawned, handler, 'helix.multiplayer.objects.onDespawned', (binding) => [handleOf(binding)]),
        onOwnerChanged: (handler: unknown) => listen<OwnerChange>(host, MULTIPLAYER_EVENT.ownerChanged, handler, 'helix.multiplayer.objects.onOwnerChanged', ({ binding, previousOwnerId }) => [handleOf(binding), previousOwnerId]),
        onCorrected: (handler: unknown) => listen<BoundObject>(host, MULTIPLAYER_EVENT.objectCorrected, handler, 'helix.multiplayer.objects.onCorrected', (binding) => [handleOf(binding)]),
    };
    return { api, ofActor, find };
}
