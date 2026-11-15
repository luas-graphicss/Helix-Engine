import type { ProviderEndpoint } from './chat-protocol';
export function bearerHeaders(endpoint: ProviderEndpoint): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (endpoint.apiKey)
        headers.authorization = `Bearer ${endpoint.apiKey}`;
    return headers;
}
