import { FileBundle, type BundleEntry } from './file-bundle';
import { importModelFile } from './import-registry';
import type { ImportedScene } from './import-types';
import { computeTangents } from '@/engine/renderer/geometry/tangent-frame';
export interface ImportWorkerRequest {
    jobId: number;
    file: File;
    bundle: BundleEntry[];
}
export type ImportWorkerResponse = {
    jobId: number;
    type: 'progress';
    fraction: number;
    stage: string;
} | {
    jobId: number;
    type: 'done';
    scene: ImportedScene;
} | {
    jobId: number;
    type: 'error';
    message: string;
};
const PROGRESS_INTERVAL_MS = 40;
interface WorkerScope {
    onmessage: ((event: MessageEvent<ImportWorkerRequest>) => void) | null;
    postMessage(message: ImportWorkerResponse, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
function collectTransferables(scene: ImportedScene): Transferable[] {
    const buffers = new Set<ArrayBuffer>();
    const add = (view: ArrayBufferView | undefined) => {
        if (view && view.buffer instanceof ArrayBuffer)
            buffers.add(view.buffer);
    };
    for (const { geometry } of scene.meshes) {
        add(geometry.positions);
        add(geometry.normals);
        add(geometry.uvs);
        add(geometry.tangents);
        add(geometry.indices);
        add(geometry.skinning?.joints);
        add(geometry.skinning?.weights);
    }
    for (const skin of scene.skins)
        add(skin.inverseBindMatrices);
    for (const animation of scene.animations) {
        for (const channel of animation.channels) {
            add(channel.times);
            add(channel.values);
        }
    }
    return Array.from(buffers);
}
function withTangents(scene: ImportedScene): ImportedScene {
    for (const mesh of scene.meshes) {
        const { geometry } = mesh;
        if (!mesh.hadUvs || geometry.tangents)
            continue;
        mesh.geometry = { ...geometry, tangents: computeTangents(geometry.positions, geometry.normals, geometry.uvs, geometry.indices) };
    }
    return scene;
}
scope.onmessage = async (event) => {
    const { jobId, file, bundle } = event.data;
    let lastReport = 0;
    const report = (fraction: number, stage: string) => {
        const now = performance.now();
        if (fraction < 1 && now - lastReport < PROGRESS_INTERVAL_MS)
            return;
        lastReport = now;
        scope.postMessage({ jobId, type: 'progress', fraction, stage });
    };
    try {
        const scene = withTangents(await importModelFile(file, FileBundle.fromEntries(bundle), report));
        scope.postMessage({ jobId, type: 'done', scene }, collectTransferables(scene));
    }
    catch (cause) {
        scope.postMessage({ jobId, type: 'error', message: cause instanceof Error ? cause.message : String(cause) });
    }
};
