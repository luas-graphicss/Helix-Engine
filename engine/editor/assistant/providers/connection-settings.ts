import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import { PROTOCOL_IDS, type ProtocolId, type ProviderEndpoint } from './chat-protocol';
import { isRecord } from './json-value';
import { CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_ID, findProviderPreset, PROVIDER_PRESETS } from './provider-catalog';
export interface ProviderProfile {
    readonly protocol: ProtocolId;
    readonly baseUrl: string;
    readonly model: string;
    readonly apiKey: string;
}
export interface ConnectionSettings {
    readonly providerId: string;
    readonly rememberKeys: boolean;
    readonly profiles: Readonly<Record<string, ProviderProfile>>;
}
const PREFERENCE_KEY = 'assistant-connection';
export function presetProfile(providerId: string): ProviderProfile {
    const preset = findProviderPreset(providerId);
    return { protocol: preset.protocol, baseUrl: preset.baseUrl, model: '', apiKey: '' };
}
export function createConnectionSettings(): ConnectionSettings {
    return { providerId: DEFAULT_PROVIDER_ID, rememberKeys: false, profiles: {} };
}
export function activeProfile(settings: ConnectionSettings): ProviderProfile {
    return Object.hasOwn(settings.profiles, settings.providerId) ? settings.profiles[settings.providerId] : presetProfile(settings.providerId);
}
export function endpointOf(settings: ConnectionSettings): ProviderEndpoint {
    const profile = activeProfile(settings);
    return { baseUrl: profile.baseUrl.trim(), apiKey: profile.apiKey.trim(), model: profile.model.trim() };
}
export function connectionProblem(settings: ConnectionSettings): string | null {
    const endpoint = endpointOf(settings);
    if (!endpoint.baseUrl)
        return 'Informe a URL base do provedor.';
    if (!endpoint.apiKey && findProviderPreset(settings.providerId).keyRequired)
        return 'Informe a chave de API.';
    return endpoint.model ? null : 'Informe o modelo.';
}
function readProfile(stored: unknown, providerId: string, keepKey: boolean): ProviderProfile {
    const preset = presetProfile(providerId);
    if (!isRecord(stored))
        return preset;
    const protocol = PROTOCOL_IDS.find((id) => id === stored.protocol) ?? preset.protocol;
    return {
        protocol: providerId === CUSTOM_PROVIDER_ID ? protocol : preset.protocol,
        baseUrl: typeof stored.baseUrl === 'string' ? stored.baseUrl : preset.baseUrl,
        model: typeof stored.model === 'string' ? stored.model : '',
        apiKey: keepKey && typeof stored.apiKey === 'string' ? stored.apiKey : '',
    };
}
function restoreSettings(persisted: unknown): ConnectionSettings {
    if (!isRecord(persisted))
        return createConnectionSettings();
    const rememberKeys = persisted.rememberKeys === true;
    const stored = isRecord(persisted.profiles) ? persisted.profiles : {};
    const profiles: Record<string, ProviderProfile> = {};
    for (const preset of PROVIDER_PRESETS) {
        if (Object.hasOwn(stored, preset.id))
            profiles[preset.id] = readProfile(stored[preset.id], preset.id, rememberKeys);
    }
    const providerId = typeof persisted.providerId === 'string' ? findProviderPreset(persisted.providerId).id : DEFAULT_PROVIDER_ID;
    return { providerId, rememberKeys, profiles };
}
export async function loadConnectionSettings(): Promise<ConnectionSettings> {
    return restoreSettings(await readPreference<unknown>(PREFERENCE_KEY));
}
export function saveConnectionSettings(settings: ConnectionSettings): Promise<void> {
    const profiles: Record<string, ProviderProfile> = {};
    for (const [providerId, profile] of Object.entries(settings.profiles))
        profiles[providerId] = settings.rememberKeys ? profile : { ...profile, apiKey: '' };
    return writePreference(PREFERENCE_KEY, { ...settings, profiles });
}
