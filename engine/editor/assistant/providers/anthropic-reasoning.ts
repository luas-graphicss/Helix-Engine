import type { ProviderEndpoint, ReasoningEffort } from './chat-protocol';
import { isRecord, type JsonRecord } from './json-value';
import { ProviderError, requestJson, resolveEndpointUrl } from './provider-http';
const PROBE_TIMEOUT_MS = 15000;
const EFFORT_LEVELS = ['low', 'medium', 'high'] as const;
interface ReasoningSupport {
    readonly adaptiveThinking: boolean;
    readonly efforts: readonly string[];
}
const NO_SUPPORT: ReasoningSupport = { adaptiveThinking: false, efforts: [] };
const knownSupport = new Map<string, ReasoningSupport>();
function isSupported(capability: unknown): boolean {
    return isRecord(capability) && capability.supported === true;
}
function readSupport(model: unknown): ReasoningSupport {
    const capabilities = isRecord(model) && isRecord(model.capabilities) ? model.capabilities : {};
    const { thinking, effort } = capabilities;
    const thinkingTypes = isRecord(thinking) && isRecord(thinking.types) ? thinking.types : {};
    const effortLevels = isRecord(effort) ? effort : {};
    return { adaptiveThinking: isSupported(thinkingTypes.adaptive), efforts: EFFORT_LEVELS.filter((level) => isSupported(effortLevels[level])) };
}
function isTimeout(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === 'TimeoutError';
}
async function loadSupport(endpoint: ProviderEndpoint, headers: Readonly<Record<string, string>>, signal: AbortSignal): Promise<ReasoningSupport> {
    const key = `${endpoint.baseUrl}\n${endpoint.model}`;
    const known = knownSupport.get(key);
    if (known)
        return known;
    try {
        const url = resolveEndpointUrl(endpoint.baseUrl, `models/${encodeURIComponent(endpoint.model)}`);
        const support = readSupport(await requestJson(url, { method: 'GET', headers, signal: AbortSignal.any([signal, AbortSignal.timeout(PROBE_TIMEOUT_MS)]) }));
        knownSupport.set(key, support);
        return support;
    }
    catch (cause) {
        if (signal.aborted || !(cause instanceof ProviderError || isTimeout(cause)))
            throw cause;
        return NO_SUPPORT;
    }
}
export async function reasoningFields(endpoint: ProviderEndpoint, effort: ReasoningEffort, headers: Readonly<Record<string, string>>, signal: AbortSignal): Promise<JsonRecord> {
    const support = await loadSupport(endpoint, headers, signal);
    const fields: JsonRecord = {};
    if (support.adaptiveThinking)
        fields.thinking = { type: 'adaptive', display: 'summarized' };
    if (support.efforts.includes(effort))
        fields.output_config = { effort };
    return fields;
}
