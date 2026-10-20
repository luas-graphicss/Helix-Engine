import { getMeshVersion, getTriangleCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { buildMyriadMesh, type MyriadBuildProgress } from '../build/build-myriad-mesh';
import type { MyriadWorkerRequest, MyriadWorkerResponse } from '../build/myriad-build.worker';
import type { PackedMyriadMesh } from '../data/myriad-mesh';
import { MIN_VIRTUAL_TRIANGLES } from '../data/myriad-limits';
export type MyriadEntryState = 'queued' | 'building' | 'ready' | 'failed';
export class MyriadMeshEntry {
    state: MyriadEntryState = 'queued';
    packed: PackedMyriadMesh | null = null;
    progress: MyriadBuildProgress | null = null;
    error: string | null = null;
    residency: MeshResidency | null = null;
    groupStamp: Uint32Array | null = null;
    constructor(readonly source: MeshData, readonly version: number) { }
}
export interface MeshResidency {
    vertexBase: number;
    vertexCount: number;
    clusterBase: number;
    clusterCount: number;
}
export interface MyriadCacheStats {
    pending: number;
    ready: number;
    failed: number;
    building: string;
}
const MAX_IN_FLIGHT = 1;
function createWorker(): Worker | null {
    if (typeof Worker === 'undefined')
        return null;
    try {
        return new Worker(new URL('../build/myriad-build.worker.ts', import.meta.url), { type: 'module' });
    }
    catch {
        return null;
    }
}
export class MyriadMeshCache {
    readonly stats: MyriadCacheStats = { pending: 0, ready: 0, failed: 0, building: '' };
    readonly evicted: MyriadMeshEntry[] = [];
    private readonly entries = new WeakMap<MeshData, MyriadMeshEntry>();
    private readonly queue: MyriadMeshEntry[] = [];
    private readonly jobs = new Map<number, MyriadMeshEntry>();
    private worker: Worker | null;
    private nextJobId = 1;
    constructor() {
        this.worker = createWorker();
        if (this.worker) {
            this.worker.onmessage = (event: MessageEvent<MyriadWorkerResponse>) => this.receive(event.data);
            this.worker.onerror = () => this.abandonWorker();
        }
    }
    resolve(mesh: MeshData): MyriadMeshEntry | null {
        if (getTriangleCount(mesh) < MIN_VIRTUAL_TRIANGLES)
            return null;
        const version = getMeshVersion(mesh);
        let entry = this.entries.get(mesh);
        if (entry && entry.version !== version) {
            this.evict(entry);
            entry = undefined;
        }
        if (!entry) {
            entry = new MyriadMeshEntry(mesh, version);
            this.entries.set(mesh, entry);
            this.queue.push(entry);
        }
        return entry;
    }
    pump(): void {
        if (this.worker) {
            while (this.jobs.size < MAX_IN_FLIGHT && this.queue.length > 0)
                this.dispatch(this.queue.shift() as MyriadMeshEntry);
        }
        else {
            const entry = this.queue.shift();
            if (entry)
                this.buildOnMainThread(entry);
        }
        this.stats.pending = this.queue.length + this.jobs.size;
    }
    private dispatch(entry: MyriadMeshEntry): void {
        const jobId = this.nextJobId++;
        this.jobs.set(jobId, entry);
        entry.state = 'building';
        const { source } = entry;
        const request: MyriadWorkerRequest = {
            jobId,
            input: { positions: source.positions.slice(), normals: source.normals.slice(), uvs: source.uvs.slice(), indices: source.indices.slice() },
        };
        const { input } = request;
        this.worker?.postMessage(request, [input.positions.buffer, input.normals.buffer, input.uvs.buffer, input.indices.buffer]);
    }
    private buildOnMainThread(entry: MyriadMeshEntry): void {
        entry.state = 'building';
        try {
            this.complete(entry, buildMyriadMesh(entry.source));
        }
        catch (cause) {
            this.fail(entry, cause instanceof Error ? cause.message : String(cause));
        }
    }
    private receive(response: MyriadWorkerResponse): void {
        const entry = this.jobs.get(response.jobId);
        if (!entry)
            return;
        if (response.type === 'progress') {
            entry.progress = response.progress;
            this.stats.building = describeProgress(entry.source, response.progress);
            return;
        }
        this.jobs.delete(response.jobId);
        this.stats.building = '';
        if (response.type === 'done')
            this.complete(entry, response.mesh);
        else
            this.fail(entry, response.message);
    }
    private complete(entry: MyriadMeshEntry, packed: PackedMyriadMesh): void {
        if (this.entries.get(entry.source) !== entry)
            return;
        entry.packed = packed;
        entry.groupStamp = new Uint32Array(packed.groupCount);
        entry.state = 'ready';
        entry.progress = null;
        this.stats.ready++;
    }
    private fail(entry: MyriadMeshEntry, message: string): void {
        entry.state = 'failed';
        entry.error = message;
        entry.progress = null;
        this.stats.failed++;
        console.warn(`[Myriad] Falha ao virtualizar "${entry.source.name}": ${message}`);
    }
    private evict(entry: MyriadMeshEntry): void {
        const queued = this.queue.indexOf(entry);
        if (queued !== -1)
            this.queue.splice(queued, 1);
        if (entry.state === 'ready')
            this.stats.ready--;
        if (entry.residency)
            this.evicted.push(entry);
    }
    private abandonWorker(): void {
        this.worker?.terminate();
        this.worker = null;
        for (const entry of this.jobs.values()) {
            entry.state = 'queued';
            this.queue.push(entry);
        }
        this.jobs.clear();
    }
    dispose(): void {
        this.worker?.terminate();
        this.worker = null;
        this.queue.length = 0;
        this.jobs.clear();
    }
}
function describeProgress(mesh: MeshData, progress: MyriadBuildProgress): string {
    if (progress.phase === 'weld')
        return `${mesh.name}: soldando vértices`;
    if (progress.phase === 'pack')
        return `${mesh.name}: empacotando`;
    return `${mesh.name}: nível ${progress.level} · ${progress.levelClusters} clusters · ${progress.levelTriangles.toLocaleString('pt-BR')} tris`;
}
