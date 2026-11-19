import type { GL } from './context';
import { GpuMesh } from './gpu-mesh';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
const TRIM_INTERVAL_MS = 500;
const IDLE_BEFORE_RELEASE_MS = 2000;
const BYTES_PER_MEGABYTE = 1024 * 1024;
interface CacheEntry {
    mesh: GpuMesh;
    version: number;
    lastUsedAt: number;
}
export interface MeshResidencySettings {
    meshCompression: boolean;
    meshStreaming: boolean;
    meshBudgetMb: number;
}
export interface MeshResidencyStats {
    resident: number;
    residentBytes: number;
    released: number;
}
export class GpuMeshCache {
    readonly stats: MeshResidencyStats = { resident: 0, residentBytes: 0, released: 0 };
    private readonly entries = new Map<MeshData, CacheEntry>();
    private compression = false;
    private now = 0;
    private nextTrimAt = 0;
    constructor(private readonly gl: GL) { }
    configure(settings: MeshResidencySettings, now: number): void {
        this.now = now;
        if (settings.meshCompression !== this.compression) {
            this.compression = settings.meshCompression;
            this.releaseAll();
        }
        if (!settings.meshStreaming || now < this.nextTrimAt)
            return;
        this.nextTrimAt = now + TRIM_INTERVAL_MS;
        this.releaseIdle(settings.meshBudgetMb * BYTES_PER_MEGABYTE);
    }
    resolve(data: MeshData): GpuMesh {
        const version = getMeshVersion(data);
        const { stats } = this;
        let entry = this.entries.get(data);
        if (!entry) {
            entry = { mesh: new GpuMesh(this.gl, data, this.compression && data.dynamic !== true), version, lastUsedAt: this.now };
            this.entries.set(data, entry);
            stats.resident++;
            stats.residentBytes += entry.mesh.byteLength;
        }
        else if (entry.version !== version) {
            stats.residentBytes -= entry.mesh.byteLength;
            entry.mesh.update(data);
            stats.residentBytes += entry.mesh.byteLength;
            entry.version = version;
        }
        entry.lastUsedAt = this.now;
        return entry.mesh;
    }
    dispose(): void {
        this.releaseAll();
    }
    private releaseIdle(budgetBytes: number): void {
        const { stats, now } = this;
        if (stats.residentBytes <= budgetBytes)
            return;
        const idle = [...this.entries].filter(([, entry]) => now - entry.lastUsedAt >= IDLE_BEFORE_RELEASE_MS);
        idle.sort(([, a], [, b]) => a.lastUsedAt - b.lastUsedAt);
        for (const [data, entry] of idle) {
            if (stats.residentBytes <= budgetBytes)
                break;
            this.release(data, entry);
            stats.released++;
        }
    }
    private release(data: MeshData, entry: CacheEntry): void {
        this.stats.resident--;
        this.stats.residentBytes -= entry.mesh.byteLength;
        entry.mesh.dispose();
        this.entries.delete(data);
    }
    private releaseAll(): void {
        for (const entry of this.entries.values())
            entry.mesh.dispose();
        this.entries.clear();
        this.stats.resident = 0;
        this.stats.residentBytes = 0;
    }
}
