import { AGENT_ROUTE, BRIDGE_ROUTE, isSessionId } from '@/engine/mcp/protocol/session-address';
import { renderRootHelp } from './agent/agent-guide';
import { isAuthorized } from './http/access-guard';
import { emptyResponse, jsonResponse, textResponse } from './http/http-responses';
import type { WorkerEnv } from './runtime/durable-object-types';
import { readWorkerSettings } from './runtime/worker-settings';
export { EngineSession } from './session/engine-session';
const HEALTH_ROUTE = 'health';
const SESSION_ROUTES: ReadonlySet<string> = new Set([AGENT_ROUTE, BRIDGE_ROUTE]);
async function route(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS')
        return emptyResponse(204);
    const url = new URL(request.url);
    const [area, session, token] = url.pathname.split('/').filter(Boolean);
    if (area === undefined)
        return textResponse(renderRootHelp(url.origin));
    if (area === HEALTH_ROUTE)
        return textResponse('ok\n');
    if (!SESSION_ROUTES.has(area))
        return textResponse(`Unknown route.\n\n${renderRootHelp(url.origin)}`, 404);
    if (!session || !token || !isSessionId(session) || !isSessionId(token))
        return textResponse('The session and the token must have 6 to 80 characters among A-Z a-z 0-9 _ -.\n', 400);
    if (!(await isAuthorized(request, readWorkerSettings(env).secret)))
        return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'This Worker requires the header Authorization: Bearer <SECRET>.' } }, 401);
    return env.SESSIONS.get(env.SESSIONS.idFromName(`${session}/${token}`)).fetch(request);
}
export default {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
        try {
            return await route(request, env);
        }
        catch (cause) {
            console.error(cause);
            return jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'The MCP Worker failed to handle the request.' } }, 500);
        }
    },
};
