const AGENT_PATTERN = /^[A-Za-z0-9_.:-]{1,96}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
const ANONYMOUS_AGENT = 'agent';
export interface AgentContext {
    readonly agent: string;
    readonly baseUrl: string;
    readonly idempotencyKey: string | null;
}
export function readAgentContext(request: Request, url: URL, baseUrl: string): AgentContext {
    const agent = request.headers.get('x-mcp-agent') ?? url.searchParams.get('agent') ?? '';
    const idempotencyKey = request.headers.get('idempotency-key') ?? '';
    return {
        agent: AGENT_PATTERN.test(agent) ? agent : ANONYMOUS_AGENT,
        baseUrl,
        idempotencyKey: IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) ? idempotencyKey : null,
    };
}
