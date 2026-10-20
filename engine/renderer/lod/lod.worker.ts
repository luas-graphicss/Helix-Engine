import { simplifyByClustering, type SimplifierInput, type SimplifierOutput } from './mesh-simplifier';
export interface LodWorkerRequest {
    jobId: number;
    cells: number;
    input: SimplifierInput;
}
export interface LodWorkerResponse {
    jobId: number;
    output: SimplifierOutput;
}
interface WorkerScope {
    onmessage: ((event: MessageEvent<LodWorkerRequest>) => void) | null;
    postMessage(message: LodWorkerResponse, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
    const { jobId, cells, input } = event.data;
    const output = simplifyByClustering(input, cells);
    scope.postMessage({ jobId, output }, [output.positions.buffer, output.normals.buffer, output.uvs.buffer, output.indices.buffer]);
};
