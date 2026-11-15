import { DEFAULT_MCP_ACCESS_MODE, isMcpAccessModeId, type McpAccessModeId } from '@/engine/editor/mcp/execution/access-policy';
import { isRecord, isText } from '@/engine/mcp/protocol/json-shape';
import { agentEndpoint, isSessionId, type SessionAddress } from '@/engine/mcp/protocol/session-address';
import { createSessionAddress } from './session-credentials';
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
export interface BridgeSettings {
    readonly enabled: boolean;
    readonly workerUrl: string;
    readonly secret: string;
    readonly accessMode: McpAccessModeId;
    readonly address: SessionAddress;
}
export function createBridgeSettings(): BridgeSettings {
    return { enabled: false, workerUrl: '', secret: '', accessMode: DEFAULT_MCP_ACCESS_MODE, address: createSessionAddress() };
}
function parseAddress(value: unknown): SessionAddress | null {
    if (!isRecord(value))
        return null;
    const { session, token } = value;
    return isText(session) && isText(token) && isSessionId(session) && isSessionId(token) ? { session, token } : null;
}
export function parseBridgeSettings(stored: unknown): BridgeSettings {
    const defaults = createBridgeSettings();
    if (!isRecord(stored))
        return defaults;
    const { enabled, workerUrl, secret, accessMode } = stored;
    return {
        enabled: enabled === true,
        workerUrl: isText(workerUrl) ? workerUrl : defaults.workerUrl,
        secret: isText(secret) ? secret : defaults.secret,
        accessMode: isMcpAccessModeId(accessMode) ? accessMode : defaults.accessMode,
        address: parseAddress(stored.address) ?? defaults.address,
    };
}
export function parseWorkerOrigin(workerUrl: string): string | null {
    const trimmed = workerUrl.trim();
    if (!trimmed)
        return null;
    const candidate = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!URL.canParse(candidate))
        return null;
    const url = new URL(candidate);
    const trusted = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
    return trusted && !url.username && !url.password ? url.origin : null;
}
export function workerUrlProblem(settings: BridgeSettings): string | null {
    if (!settings.workerUrl.trim())
        return settings.enabled ? 'Informe a URL do Worker para conectar.' : null;
    return parseWorkerOrigin(settings.workerUrl) ? null : 'URL do Worker inválida. Use o endereço https que o wrangler mostrou.';
}
export function agentUrlOf(settings: BridgeSettings): string | null {
    const origin = parseWorkerOrigin(settings.workerUrl);
    return origin ? agentEndpoint(origin, settings.address) : null;
}
