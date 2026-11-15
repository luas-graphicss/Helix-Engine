import type { ChatProtocol, ProviderEndpoint } from './chat-protocol';
import { activeProfile, createConnectionSettings, endpointOf, loadConnectionSettings, presetProfile, saveConnectionSettings, type ConnectionSettings, type ProviderProfile, } from './connection-settings';
import { CHAT_PROTOCOLS } from './protocol-registry';
import { CUSTOM_PROVIDER_ID, findProviderPreset } from './provider-catalog';
const PERSIST_DELAY_MS = 400;
type Listener = () => void;
export class ConnectionStore {
    private settings = createConnectionSettings();
    private edited = false;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): ConnectionSettings => this.settings;
    get endpoint(): ProviderEndpoint {
        return endpointOf(this.settings);
    }
    get protocol(): ChatProtocol {
        return CHAT_PROTOCOLS[activeProfile(this.settings).protocol];
    }
    async load(): Promise<void> {
        const restored = await loadConnectionSettings();
        if (!this.edited)
            this.publish(restored);
    }
    selectProvider(providerId: string): void {
        const preset = findProviderPreset(providerId);
        if (preset.id === this.settings.providerId)
            return;
        this.commit({ ...this.settings, providerId: preset.id });
    }
    updateProfile(patch: Partial<ProviderProfile>): void {
        const { providerId } = this.settings;
        const current = activeProfile(this.settings);
        const protocol = providerId === CUSTOM_PROVIDER_ID ? (patch.protocol ?? current.protocol) : presetProfile(providerId).protocol;
        const profile: ProviderProfile = { ...current, ...patch, protocol };
        this.commit({ ...this.settings, profiles: { ...this.settings.profiles, [providerId]: profile } });
    }
    setRememberKeys(rememberKeys: boolean): void {
        if (rememberKeys === this.settings.rememberKeys)
            return;
        this.commit({ ...this.settings, rememberKeys });
    }
    private commit(settings: ConnectionSettings): void {
        this.edited = true;
        this.publish(settings);
        this.schedulePersist();
    }
    private publish(settings: ConnectionSettings): void {
        this.settings = settings;
        for (const listener of this.listeners)
            listener();
    }
    private schedulePersist(): void {
        if (this.persistTimer)
            clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            void saveConnectionSettings(this.settings);
        }, PERSIST_DELAY_MS);
    }
}
