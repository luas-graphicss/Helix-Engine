import { mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import { audioMimeTypeFromFileName } from '@/engine/audio/core/audio-formats';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
const API_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 120000;
const JSON_LIMIT_BYTES = 16 * 1024 * 1024;
const BYTES_PER_MEBIBYTE = 1024 * 1024;
const SECURE_PROTOCOL = 'https:';
const SERVER_FAILURE_STATUS = 500;
export type RequestHeaders = Readonly<Record<string, string>>;
function describeStatus(host: string, status: number): string {
    if (status === 401 || status === 403)
        return `${host} refused the request (HTTP ${status}). The API key is missing, wrong or not allowed to read this asset. Ask the user to review it in the Assistant panel, under MCP.`;
    if (status === 404)
        return `${host} did not find it (HTTP 404). Check the asset reference with search_assets.`;
    if (status === 429)
        return `${host} is limiting the request rate (HTTP 429). Wait before calling again.`;
    if (status >= SERVER_FAILURE_STATUS)
        return `${host} is failing on its side (HTTP ${status}). Try again later or use another source.`;
    return `${host} answered HTTP ${status}.`;
}
function describeTransportFailure(cause: unknown): string {
    if (cause instanceof DOMException && cause.name === 'TimeoutError')
        return 'the request timed out.';
    if (cause instanceof TypeError)
        return 'the browser could not complete the request, because the network failed or the server does not allow downloads from a web page.';
    return cause instanceof Error ? cause.message : String(cause);
}
async function send(url: URL, timeoutMs: number, headers?: RequestHeaders): Promise<Response> {
    if (url.protocol !== SECURE_PROTOCOL)
        throw new ToolFailure(`Refused to request ${url.hostname}: only https addresses are accepted.`);
    let response: Response;
    try {
        response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), credentials: 'omit', referrerPolicy: 'no-referrer' });
    }
    catch (cause) {
        throw new ToolFailure(`Could not reach ${url.hostname}: ${describeTransportFailure(cause)}`);
    }
    if (!response.ok)
        throw new ToolFailure(describeStatus(url.hostname, response.status));
    return response;
}
function tooLarge(host: string, limitBytes: number): ToolFailure {
    return new ToolFailure(`The file from ${host} exceeds the limit of ${Math.round(limitBytes / BYTES_PER_MEBIBYTE)} MB. Choose a lighter format or quality.`);
}
async function readBody(response: Response, limitBytes: number, host: string): Promise<Blob> {
    const declared = Number(response.headers.get('content-length') ?? Number.NaN);
    if (declared > limitBytes)
        throw tooLarge(host, limitBytes);
    if (!response.body)
        return new Blob([]);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            return new Blob(chunks);
        received += value.byteLength;
        if (received > limitBytes) {
            await reader.cancel();
            throw tooLarge(host, limitBytes);
        }
        chunks.push(value);
    }
}
export async function requestJson(url: URL, headers?: RequestHeaders): Promise<unknown> {
    const response = await send(url, API_TIMEOUT_MS, headers);
    const body = await readBody(response, JSON_LIMIT_BYTES, url.hostname);
    try {
        return JSON.parse(await body.text()) as unknown;
    }
    catch (cause) {
        if (cause instanceof SyntaxError)
            throw new ToolFailure(`${url.hostname} sent an answer that is not JSON.`);
        throw cause;
    }
}
export async function downloadFile(url: URL, name: string, limitBytes: number): Promise<File> {
    const response = await send(url, DOWNLOAD_TIMEOUT_MS);
    const body = await readBody(response, limitBytes, url.hostname);
    return new File([body], name, { type: mimeTypeFromFileName(name) ?? audioMimeTypeFromFileName(name) ?? '' });
}
