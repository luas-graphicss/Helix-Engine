import { readBytes, RequestBodyError } from '@/engine/mcp/worker/http/request-body';
const CALL_BODY_LIMIT_BYTES = 4 * 1024 * 1024;
function parseForm(text: string): Record<string, unknown> {
    const grouped = new Map<string, string[]>();
    for (const [name, value] of new URLSearchParams(text))
        grouped.set(name, [...(grouped.get(name) ?? []), value]);
    return Object.fromEntries(Array.from(grouped, ([name, values]) => [name, values.length === 1 ? values[0] : values]));
}
function parseJsonBody(text: string): unknown {
    try {
        return JSON.parse(text);
    }
    catch {
        throw new RequestBodyError('The body is not valid JSON.', 400);
    }
}
export async function readCallArguments(request: Request): Promise<unknown> {
    const text = new TextDecoder().decode(await readBytes(request, CALL_BODY_LIMIT_BYTES));
    if (text.trim() === '')
        return {};
    const sentAsJson = (request.headers.get('content-type') ?? '').includes('json') || text.trimStart().startsWith('{');
    return sentAsJson ? parseJsonBody(text) : parseForm(text);
}
