import { useSyncExternalStore } from 'react';
import { readPreference, writePreference } from '@/engine/core/storage/preferences';
const PREFERENCE_KEY = 'beta-features';
export interface BetaFeature {
    readonly id: string;
    readonly label: string;
    readonly description: string;
}
export const MIX_LANGUAGES_FEATURE = 'mix-languages';
export const BETA_FEATURES: readonly BetaFeature[] = [
    {
        id: MIX_LANGUAGES_FEATURE,
        label: 'Mesclagem de linguagens',
        description: 'Permite scripts em linguagens diferentes no mesmo jogo: os menus "Novo script" ganham a opção "Em outra linguagem" e scripts importados fora da linguagem base passam a rodar.',
    },
];
const KNOWN_IDS = new Set(BETA_FEATURES.map((feature) => feature.id));
class BetaFeaturesStore {
    private readonly enabled = new Set<string>();
    private version = 0;
    private loaded = false;
    private readonly listeners = new Set<() => void>();
    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    async load(): Promise<void> {
        if (this.loaded)
            return;
        this.loaded = true;
        const stored = await readPreference<unknown>(PREFERENCE_KEY);
        if (!Array.isArray(stored))
            return;
        for (const id of stored)
            if (typeof id === 'string' && KNOWN_IDS.has(id))
                this.enabled.add(id);
        this.notify();
    }
    isEnabled(id: string): boolean {
        return this.enabled.has(id);
    }
    get enabledCount(): number {
        return this.enabled.size;
    }
    setEnabled(id: string, enabled: boolean): void {
        if (!KNOWN_IDS.has(id) || this.enabled.has(id) === enabled)
            return;
        if (enabled)
            this.enabled.add(id);
        else
            this.enabled.delete(id);
        this.notify();
        void writePreference(PREFERENCE_KEY, Array.from(this.enabled));
    }
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
export const betaFeatures = new BetaFeaturesStore();
export function useBetaFeaturesVersion(): number {
    return useSyncExternalStore(betaFeatures.subscribe, betaFeatures.getVersion, betaFeatures.getVersion);
}
