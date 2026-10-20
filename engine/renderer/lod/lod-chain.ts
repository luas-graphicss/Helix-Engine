import { getMeshVersion, getTriangleCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { simplifyByClustering, toMeshData, type SimplifierOutput } from './mesh-simplifier';
import type { LodWorkerRequest, LodWorkerResponse } from './lod.worker';
export const MIN_TRIANGLES_FOR_LOD = 300;
const LEVEL_CELLS: readonly number[] = [40, 20, 10, 5];
const MIN_REDUCTION = 0.3;
const MIN_LEVEL_TRIANGLES = 24;
const MAX_IN_FLIGHT = 2;
export const MAX_LOD_LEVELS = LEVEL_CELLS.length + 1;
export interface LodChain {
    readonly levels: readonly MeshData[];
    readonly complete: boolean;
}
class ChainEntry implements LodChain {
    readonly levels: MeshData[];
    complete: boolean;
    inFlight = false;
    constructor(readonly source: MeshData, readonly version: number) {
        this.levels = [source];
        this.complete = getTriangleCount(source) < MIN_TRIANGLES_FOR_LOD;
    }
}
interface PendingJob {
    entry: ChainEntry;
    cells: number;
}
function createWorker(): Worker | null {
    if (typeof Worker === 'undefined')
        return null;
    try {
        return new Worker(new URL('./lod.worker.ts', import.meta.url), { type: 'module' });
    }
    catch {
        return null;
    }
}
export class LodChainCache {
    private readonly entries = new WeakMap<MeshData, ChainEntry>();
    private readonly queue: PendingJob[] = [];
    private readonly jobs = new Map<number, PendingJob>();
    private worker: Worker | null;
    private nextJobId = 1;
    constructor() {
        this.worker = createWorker();
        if (this.worker) {
            this.worker.onmessage = (event: MessageEvent<LodWorkerResponse>) => this.complete(event.data.jobId, event.data.output);
            this.worker.onerror = () => this.abandonWorker();
        }
    }
    get pending(): number {
        return this.queue.length + this.jobs.size;
    }
    resolve(mesh: MeshData): LodChain {
        const version = getMeshVersion(mesh);
        let entry = this.entries.get(mesh);
        if (!entry || entry.version !== version) {
            entry = new ChainEntry(mesh, version);
            this.entries.set(mesh, entry);
        }
        if (!entry.complete && !entry.inFlight)
            this.enqueue(entry);
        return entry;
    }
    pump(): void {
        if (this.worker) {
            while (this.jobs.size < MAX_IN_FLIGHT && this.queue.length > 0)
                this.dispatch(this.queue.shift() as PendingJob);
            return;
        }
        const job = this.queue.shift();
        if (!job)
            return;
        const { source } = job.entry;
        this.complete(this.register(job), simplifyByClustering(source, job.cells));
    }
    private enqueue(entry: ChainEntry): void {
        entry.inFlight = true;
        this.queue.push({ entry, cells: LEVEL_CELLS[entry.levels.length - 1] });
    }
    private register(job: PendingJob): number {
        const jobId = this.nextJobId++;
        this.jobs.set(jobId, job);
        return jobId;
    }
    private dispatch(job: PendingJob): void {
        const jobId = this.register(job);
        const { source } = job.entry;
        const request: LodWorkerRequest = {
            jobId,
            cells: job.cells,
            input: {
                positions: source.positions.slice(),
                normals: source.normals.slice(),
                uvs: source.uvs.slice(),
                indices: source.indices.slice(),
            },
        };
        const { input } = request;
        this.worker?.postMessage(request, [input.positions.buffer, input.normals.buffer, input.uvs.buffer, input.indices.buffer]);
    }
    private complete(jobId: number, output: SimplifierOutput): void {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        this.jobs.delete(jobId);
        const { entry } = job;
        entry.inFlight = false;
        if (this.entries.get(entry.source) !== entry)
            return;
        const previous = entry.levels[entry.levels.length - 1];
        const triangles = output.indices.length / 3;
        const reducedEnough = triangles <= getTriangleCount(previous) * (1 - MIN_REDUCTION);
        if (triangles > 0 && reducedEnough) {
            entry.levels.push(toMeshData(`${entry.source.name}·LOD${entry.levels.length}`, output));
        }
        if (!reducedEnough || triangles <= MIN_LEVEL_TRIANGLES || entry.levels.length >= MAX_LOD_LEVELS)
            entry.complete = true;
    }
    private abandonWorker(): void {
        this.worker?.terminate();
        this.worker = null;
        for (const job of this.jobs.values())
            this.queue.push(job);
        this.jobs.clear();
    }
    dispose(): void {
        this.worker?.terminate();
        this.queue.length = 0;
        this.jobs.clear();
    }
}
