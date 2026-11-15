import { parseBridgeError, parseHelloResponse, parsePollResponse, parseToolAttachment } from '@/engine/mcp/protocol/bridge-message-parsers';
import type { ByeRequest, HelloRequest, HelloResponse, PollResponse, ResultBatch, ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
import { BRIDGE_PATHS, bridgeEndpoint, type SessionAddress } from '@/engine/mcp/protocol/session-address';
import { BridgeError } from './bridge-error';
const REQUEST_TIMEOUT_MS = 20000;
const TRANSFER_TIMEOUT_MS = 120000;
const POLL_MARGIN_MS = 10000;
const JSON_TYPE = 'application/json';
const FILE_NAME_PATTERN = /filename="([^"]+)"/;
const FALLBACK_FILE_NAME = 'file';
export interface BridgeTarget {
    readonly origin: string;
    readonly address: SessionAddress;
    readonly secret: string;
}
function ignoreLostBye(): void { }
async function readJsonBody(response: Response): Promise<unknown> {
    try {
        return await response.json();
    }
    catch {
        return undefined;
    }
}
function parseBody<TValue>(parse: (value: unknown) => TValue | null, body: unknown): TValue {
    const parsed = parse(body);
    if (parsed === null)
        throw new BridgeError('UNEXPECTED_RESPONSE', 'The Worker answered with an unexpected shape.');
    return parsed;
}
export class BridgeClient {
    constructor(private readonly target: BridgeTarget) { }
    async hello(request: HelloRequest, signal: AbortSignal): Promise<HelloResponse> {
        return parseBody(parseHelloResponse, await this.postJson(BRIDGE_PATHS.hello, request, REQUEST_TIMEOUT_MS, signal));
    }
    async poll(batch: ResultBatch, waitMs: number, signal: AbortSignal): Promise<PollResponse> {
        return parseBody(parsePollResponse, await this.postJson(BRIDGE_PATHS.poll, batch, waitMs + POLL_MARGIN_MS, signal));
    }
    async sendResults(batch: ResultBatch, signal: AbortSignal): Promise<void> {
        await this.postJson(BRIDGE_PATHS.results, batch, REQUEST_TIMEOUT_MS, signal);
    }
    sayBye(peer: string): void {
        const body: ByeRequest = { peer };
        void fetch(this.url(BRIDGE_PATHS.bye), { method: 'POST', keepalive: true, headers: this.headers(JSON_TYPE), body: JSON.stringify(body) }).catch(ignoreLostBye);
    }
    async downloadFile(fileId: string, signal: AbortSignal): Promise<File> {
        const response = await this.send(`${BRIDGE_PATHS.files}/${encodeURIComponent(fileId)}`, { method: 'GET', headers: this.headers() }, TRANSFER_TIMEOUT_MS, signal);
        const name = FILE_NAME_PATTERN.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? FALLBACK_FILE_NAME;
        return new File([await response.blob()], name, { type: response.headers.get('content-type') ?? '' });
    }
    async uploadFile(content: Blob, name: string, signal: AbortSignal): Promise<ToolAttachment> {
        const response = await this.send(`${BRIDGE_PATHS.files}/${encodeURIComponent(name)}`, { method: 'PUT', headers: this.headers(content.type), body: content }, TRANSFER_TIMEOUT_MS, signal);
        return parseBody(parseToolAttachment, await readJsonBody(response));
    }
    private async postJson(path: string, body: unknown, timeoutMs: number, signal: AbortSignal): Promise<unknown> {
        return readJsonBody(await this.send(path, { method: 'POST', headers: this.headers(JSON_TYPE), body: JSON.stringify(body) }, timeoutMs, signal));
    }
    private async send(path: string, init: RequestInit, timeoutMs: number, signal: AbortSignal): Promise<Response> {
        const response = await this.request(path, init, timeoutMs, signal);
        if (response.ok)
            return response;
        const failure = parseBridgeError(await readJsonBody(response));
        throw failure ? new BridgeError(failure.error.code, failure.error.message) : new BridgeError('UNEXPECTED_RESPONSE', `The Worker answered HTTP ${response.status}.`);
    }
    private async request(path: string, init: RequestInit, timeoutMs: number, signal: AbortSignal): Promise<Response> {
        try {
            return await fetch(this.url(path), { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
        }
        catch (cause) {
            if (signal.aborted)
                throw cause;
            throw new BridgeError('UNREACHABLE', cause instanceof Error ? cause.message : String(cause), { cause });
        }
    }
    private url(path: string): string {
        return bridgeEndpoint(this.target.origin, this.target.address, path);
    }
    private headers(contentType = ''): Record<string, string> {
        const headers: Record<string, string> = {};
        if (contentType)
            headers['Content-Type'] = contentType;
        if (this.target.secret)
            headers.Authorization = `Bearer ${this.target.secret}`;
        return headers;
    }
}
