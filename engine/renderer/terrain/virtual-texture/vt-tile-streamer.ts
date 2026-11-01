import type { VtWorkerRequest, VtWorkerResponse } from './vt-tile.worker';
export type VtSourceEvent = Exclude<VtWorkerResponse, {
    type: 'tile';
}>;
interface SourceLink {
    worker: Worker;
    onEvent: (event: VtSourceEvent) => void;
}
export class VtTileStreamer {
    private readonly workers: Worker[] = [];
    private readonly sources = new Map<number, SourceLink>();
    private readonly requests = new Map<number, (bitmap: ImageBitmap | null) => void>();
    private nextRequestId = 1;
    private nextWorker = 0;
    constructor() {
        const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
        const count = Math.max(1, Math.min(2, cores - 2));
        for (let i = 0; i < count; i++) {
            const worker = new Worker(new URL('./vt-tile.worker.ts', import.meta.url), { type: 'module', name: `helix-terrain-vt-${i}` });
            worker.onmessage = (event: MessageEvent<VtWorkerResponse>) => this.receive(event.data);
            this.workers.push(worker);
        }
    }
    open(sourceId: number, key: string, url: string, size: number, onEvent: (event: VtSourceEvent) => void): void {
        const worker = this.workers[this.nextWorker];
        this.nextWorker = (this.nextWorker + 1) % this.workers.length;
        this.sources.set(sourceId, { worker, onEvent });
        this.post(worker, { type: 'open', sourceId, key, url, size });
    }
    request(sourceId: number, level: number, px: number, py: number, onTile: (bitmap: ImageBitmap | null) => void): boolean {
        const link = this.sources.get(sourceId);
        if (!link)
            return false;
        const requestId = this.nextRequestId++;
        this.requests.set(requestId, onTile);
        this.post(link.worker, { type: 'tile', requestId, sourceId, level, px, py });
        return true;
    }
    close(sourceId: number): void {
        const link = this.sources.get(sourceId);
        if (!link)
            return;
        this.sources.delete(sourceId);
        this.post(link.worker, { type: 'close', sourceId });
    }
    dispose(): void {
        for (const worker of this.workers)
            worker.terminate();
        this.workers.length = 0;
        this.sources.clear();
        this.requests.clear();
    }
    private post(worker: Worker, message: VtWorkerRequest): void {
        worker.postMessage(message);
    }
    private receive(message: VtWorkerResponse): void {
        if (message.type === 'tile') {
            const onTile = this.requests.get(message.requestId);
            this.requests.delete(message.requestId);
            if (onTile)
                onTile(message.bitmap);
            else
                message.bitmap?.close();
            return;
        }
        this.sources.get(message.sourceId)?.onEvent(message);
    }
}
