import { simplifyToTriangles, type SimplifierInput, type SimplifierOutput, type SimplifierState } from './mesh-simplifier';
export interface LodWorkerRequest {
    jobId: number;
    targetTriangles: number;
    input: SimplifierInput;
    state: SimplifierState | null;
}
export interface LodWorkerResponse {
    jobId: number;
    output: SimplifierOutput;
    state: SimplifierState;
}
interface WorkerScope {
    onmessage: ((event: MessageEvent<LodWorkerRequest>) => void) | null;
    postMessage(message: LodWorkerResponse, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
    const { jobId, targetTriangles, input, state } = event.data;
    const { output, state: next } = simplifyToTriangles(input, targetTriangles, state);
    scope.postMessage({ jobId, output, state: next }, [
        output.positions.buffer,
        output.normals.buffer,
        output.uvs.buffer,
        output.indices.buffer,
        next.positionIds.buffer,
        next.quadrics.buffer,
        next.weights.buffer,
        next.deviations.buffer,
    ]);
};
