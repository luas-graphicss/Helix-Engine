'use client';
import { useSyncExternalStore } from 'react';
import { getProjectRegistry, type ProjectRegistry } from '@/engine/project/project-registry';
export function useProjectRegistry(): ProjectRegistry {
    const registry = getProjectRegistry();
    useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
    return registry;
}
