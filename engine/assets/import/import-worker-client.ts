import type { FileBundle } from './file-bundle';
import { IGNORE_PROGRESS, type ImportProgressReporter } from './import-progress';
import { importModelFile } from './import-registry';
import type { ImportedScene } from './import-types';
import type { ImportWorkerRequest, ImportWorkerResponse } from './import.worker';
const IDLE_TERMINATE_MS = 30000;
interface PendingJob {
    file: File;
    bundle: FileBundle;
    progress: ImportProgressReporter;
    resolve: (scene: ImportedScene) => void;
    reject: (cause: Error) => void;
}
class ImportWorkerClient {
    private worker: Worker | null = null;
    private workerUnavailable = false;
    private readonly pending = new Map<number, PendingJob>();
    private nextJobId = 1;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    read(file: File, bundle: FileBundle, progress: ImportProgressReporter): Promise<ImportedScene> {
        const worker = this.acquire();
        if (!worker)
            return importModelFile(file, bundle, progress);
        return new Promise<ImportedScene>((resolve, reject) => {
            const jobId = this.nextJobId++;
            this.pending.set(jobId, { file, bundle, progress, resolve, reject });
            const request: ImportWorkerRequest = { jobId, file, bundle: bundle.entries };
            worker.postMessage(request);
        });
    }
    private acquire(): Worker | null {
        if (this.idleTimer)
            clearTimeout(this.idleTimer);
        this.idleTimer = null;
        if (this.worker)
            return this.worker;
        if (this.workerUnavailable || typeof Worker === 'undefined')
            return null;
        try {
            const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module', name: 'helix-import' });
            worker.onmessage = (event: MessageEvent<ImportWorkerResponse>) => this.receive(event.data);
            worker.onerror = () => this.abandonWorker();
            this.worker = worker;
            return worker;
        }
        catch {
            this.workerUnavailable = true;
            return null;
        }
    }
    private receive(response: ImportWorkerResponse): void {
        const job = this.pending.get(response.jobId);
        if (!job)
            return;
        if (response.type === 'progress') {
            job.progress(response.fraction, response.stage);
            return;
        }
        this.pending.delete(response.jobId);
        if (response.type === 'done') {
            job.progress(1, 'Concluído');
            job.resolve(response.scene);
        }
        else {
            job.reject(new Error(response.message));
        }
        if (this.pending.size === 0)
            this.scheduleTerminate();
    }
    private abandonWorker(): void {
        this.worker?.terminate();
        this.worker = null;
        this.workerUnavailable = true;
        const jobs = Array.from(this.pending.values());
        this.pending.clear();
        for (const job of jobs)
            importModelFile(job.file, job.bundle, job.progress).then(job.resolve, job.reject);
    }
    private scheduleTerminate(): void {
        if (this.idleTimer)
            clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            if (this.pending.size > 0)
                return;
            this.worker?.terminate();
            this.worker = null;
        }, IDLE_TERMINATE_MS);
    }
}
let shared: ImportWorkerClient | null = null;
export function readModelFile(file: File, bundle: FileBundle, progress: ImportProgressReporter = IGNORE_PROGRESS): Promise<ImportedScene> {
    shared ??= new ImportWorkerClient();
    return shared.read(file, bundle, progress);
}
