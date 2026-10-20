import { buildMyriadMesh, type MyriadBuildInput, type MyriadBuildProgress } from './build-myriad-mesh';
import { packedMeshTransferables, type PackedMyriadMesh } from '../data/myriad-mesh';
export interface MyriadWorkerRequest {
    jobId: number;
    input: MyriadBuildInput;
}
export type MyriadWorkerResponse = {
    jobId: number;
    type: 'progress';
    progress: MyriadBuildProgress;
} | {
    jobId: number;
    type: 'done';
    mesh: PackedMyriadMesh;
} | {
    jobId: number;
    type: 'error';
    message: string;
};
interface WorkerScope {
    onmessage: ((event: MessageEvent<MyriadWorkerRequest>) => void) | null;
    postMessage(message: MyriadWorkerResponse, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
    const { jobId, input } = event.data;
    try {
        const mesh = buildMyriadMesh(input, (progress) => scope.postMessage({ jobId, type: 'progress', progress }));
        scope.postMessage({ jobId, type: 'done', mesh }, packedMeshTransferables(mesh));
    }
    catch (cause) {
        scope.postMessage({ jobId, type: 'error', message: cause instanceof Error ? cause.message : String(cause) });
    }
};
