import type { GL } from './context';
import { GpuMesh } from './gpu-mesh';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
interface CacheEntry {
    mesh: GpuMesh;
    version: number;
}
export class GpuMeshCache {
    private readonly entries = new Map<MeshData, CacheEntry>();
    constructor(private readonly gl: GL) { }
    resolve(data: MeshData): GpuMesh {
        const version = getMeshVersion(data);
        let entry = this.entries.get(data);
        if (!entry) {
            entry = { mesh: new GpuMesh(this.gl, data), version };
            this.entries.set(data, entry);
        }
        else if (entry.version !== version) {
            entry.mesh.update(data);
            entry.version = version;
        }
        return entry.mesh;
    }
    dispose(): void {
        for (const entry of this.entries.values())
            entry.mesh.dispose();
        this.entries.clear();
    }
}
