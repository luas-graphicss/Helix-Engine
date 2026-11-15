import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import { createBridgeSettings, parseBridgeSettings, type BridgeSettings } from './bridge-settings';
import { createSessionAddress } from './session-credentials';
const PREFERENCE_KEY = 'mcp-bridge';
const PERSIST_DELAY_MS = 400;
type Listener = () => void;
export class BridgeSettingsStore {
    private settings = createBridgeSettings();
    private edited = false;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): BridgeSettings => this.settings;
    async load(): Promise<void> {
        const stored = await readPreference<unknown>(PREFERENCE_KEY);
        if (!this.edited && stored !== null)
            this.publish(parseBridgeSettings(stored));
    }
    update(patch: Partial<Omit<BridgeSettings, 'address'>>): void {
        this.commit({ ...this.settings, ...patch });
    }
    rotateAddress(): void {
        this.commit({ ...this.settings, address: createSessionAddress() });
    }
    private commit(settings: BridgeSettings): void {
        this.edited = true;
        this.publish(settings);
        if (this.persistTimer)
            clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            void writePreference(PREFERENCE_KEY, this.settings);
        }, PERSIST_DELAY_MS);
    }
    private publish(settings: BridgeSettings): void {
        this.settings = settings;
        for (const listener of this.listeners)
            listener();
    }
}
