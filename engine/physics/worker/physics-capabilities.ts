import type { PhysicsBackend } from '@/engine/physics/world/physics-world';
export type PhysicsBackendPreference = 'auto' | 'local' | 'worker';
export interface PhysicsBackendCapabilities {
    readonly workers: boolean;
    readonly crossOriginIsolated: boolean;
    readonly sharedMemory: boolean;
}
export function detectPhysicsBackendCapabilities(): PhysicsBackendCapabilities {
    const workers = typeof Worker !== 'undefined';
    const isolated = typeof globalThis !== 'undefined' && (globalThis as {
        crossOriginIsolated?: boolean;
    }).crossOriginIsolated === true;
    const sharedMemory = isolated && typeof SharedArrayBuffer !== 'undefined';
    return { workers, crossOriginIsolated: isolated, sharedMemory };
}
export function resolvePhysicsBackend(preference: PhysicsBackendPreference, capabilities: PhysicsBackendCapabilities = detectPhysicsBackendCapabilities()): PhysicsBackend {
    if (preference === 'local' || !capabilities.workers)
        return 'local';
    return capabilities.sharedMemory ? 'worker-shared' : 'worker-copy';
}
