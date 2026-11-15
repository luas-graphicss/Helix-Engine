export const AGENT_ROUTE = 'mcp';
export const BRIDGE_ROUTE = 'bridge';
export const BRIDGE_PATHS = { hello: 'hello', poll: 'poll', results: 'results', bye: 'bye', files: 'files' } as const;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{6,80}$/;
export interface SessionAddress {
    readonly session: string;
    readonly token: string;
}
export function isSessionId(value: string): boolean {
    return SESSION_ID_PATTERN.test(value);
}
export function agentEndpoint(workerOrigin: string, address: SessionAddress): string {
    return `${workerOrigin}/${AGENT_ROUTE}/${address.session}/${address.token}`;
}
export function bridgeEndpoint(workerOrigin: string, address: SessionAddress, path: string): string {
    return `${workerOrigin}/${BRIDGE_ROUTE}/${address.session}/${address.token}/${path}`;
}
