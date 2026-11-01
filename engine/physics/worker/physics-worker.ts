import { PhysicsWorkerCore } from './physics-worker-core';
import type { PhysicsReply, PhysicsRequest } from './physics-protocol';
const scope = self as unknown as DedicatedWorkerGlobalScope;
const core = new PhysicsWorkerCore();
scope.onmessage = (event: MessageEvent<PhysicsRequest>) => {
    core.handle(event.data, (reply: PhysicsReply, transfer: Transferable[]) => {
        scope.postMessage(reply, transfer);
    });
};
