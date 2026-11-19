'use client';
import { useSyncExternalStore } from 'react';
import type { Contribution, ContributionRegistry } from '../registry/contribution-registry';
export function useContributions<TContribution extends Contribution>(registry: ContributionRegistry<TContribution>): readonly TContribution[] {
    useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
    return registry.list();
}
