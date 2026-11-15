const BASE_HEADERS: Readonly<Record<string, string>> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, Idempotency-Key, Last-Event-ID, Mcp-Protocol-Version, Mcp-Session-Id, X-Mcp-Agent',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
};
const TEXT_TYPE = 'text/plain; charset=utf-8';
export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });
}
export function textResponse(body: string, status = 200, contentType = TEXT_TYPE): Response {
    return new Response(body, { status, headers: { ...BASE_HEADERS, 'Content-Type': contentType } });
}
export function emptyResponse(status: number): Response {
    return new Response(null, { status, headers: BASE_HEADERS });
}
export function methodNotAllowed(allowed: string): Response {
    return new Response(`Method not allowed. Use ${allowed}.`, { status: 405, headers: { ...BASE_HEADERS, 'Content-Type': TEXT_TYPE, Allow: allowed } });
}
export function fileResponse(bytes: Uint8Array, mimeType: string, fileName: string): Response {
    return new Response(bytes, {
        headers: { ...BASE_HEADERS, 'Content-Type': mimeType, 'Content-Length': String(bytes.byteLength), 'Content-Disposition': `attachment; filename="${fileName}"` },
    });
}
