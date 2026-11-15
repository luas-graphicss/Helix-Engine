import { ENGINE_VERSION } from '@/engine/core/engine-info';
import { parseByeRequest, parseHelloRequest, parseResultBatch } from '@/engine/mcp/protocol/bridge-message-parsers';
import { BRIDGE_PROTOCOL_VERSION, type BridgeErrorBody, type BridgeErrorCode, type HelloResponse, type PollResponse } from '@/engine/mcp/protocol/bridge-messages';
import { BRIDGE_PATHS } from '@/engine/mcp/protocol/session-address';
import { fileResponse, jsonResponse, methodNotAllowed } from '@/engine/mcp/worker/http/http-responses';
import { readBytes, readJson } from '@/engine/mcp/worker/http/request-body';
import type { WorkerSettings } from '@/engine/mcp/worker/runtime/worker-settings';
import type { CallQueue } from '@/engine/mcp/worker/session/call-queue';
import type { EngineLink } from '@/engine/mcp/worker/session/engine-link';
import { describeFile, FILE_LIMIT_BYTES, type FileStore } from '@/engine/mcp/worker/session/file-store';
import type { PollGate } from '@/engine/mcp/worker/session/poll-gate';
const BRIDGE_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const EMPTY_BATCH: PollResponse = { calls: [] };
function bridgeError(code: BridgeErrorCode, message: string, status: number): Response {
    return jsonResponse({ error: { code, message } } satisfies BridgeErrorBody, status);
}
export class BridgeRouter {
    constructor(private readonly link: EngineLink, private readonly queue: CallQueue, private readonly gate: PollGate, private readonly files: FileStore, private readonly settings: WorkerSettings) { }
    async handle(request: Request, path: readonly string[]): Promise<Response> {
        const [action, target] = path;
        if (action === BRIDGE_PATHS.files)
            return this.handleFile(request, target);
        if (request.method !== 'POST')
            return methodNotAllowed('POST');
        const body = await readJson(request, BRIDGE_BODY_LIMIT_BYTES);
        switch (action) {
            case BRIDGE_PATHS.hello:
                return this.hello(body);
            case BRIDGE_PATHS.poll:
                return this.poll(request, body);
            case BRIDGE_PATHS.results:
                return this.acceptResults(body);
            case BRIDGE_PATHS.bye:
                return this.bye(body);
            default:
                return bridgeError('BAD_REQUEST', `Unknown bridge action "${action ?? ''}".`, 404);
        }
    }
    private async hello(body: unknown): Promise<Response> {
        const hello = parseHelloRequest(body);
        if (!hello)
            return bridgeError('BAD_REQUEST', 'Malformed hello.', 400);
        if (hello.protocol !== BRIDGE_PROTOCOL_VERSION) {
            return bridgeError('PROTOCOL_MISMATCH', `This Worker speaks bridge protocol ${BRIDGE_PROTOCOL_VERSION} and the editor sent ${hello.protocol}. Download the MCP kit again and redeploy it.`, 409);
        }
        const { replacedPeer } = await this.link.register(hello);
        if (replacedPeer) {
            this.queue.abandonDelivered();
            this.gate.release();
        }
        return jsonResponse({ serverVersion: ENGINE_VERSION, pollWaitMs: this.settings.pollWaitMs } satisfies HelloResponse);
    }
    private async poll(request: Request, body: unknown): Promise<Response> {
        const batch = parseResultBatch(body);
        if (!batch)
            return bridgeError('BAD_REQUEST', 'Malformed poll.', 400);
        const rejection = this.rejectPeer(batch.peer);
        if (rejection)
            return rejection;
        this.link.touch();
        this.queue.settle(batch.results);
        if (this.queue.waitingCount === 0) {
            const wake = await this.gate.wait(this.settings.pollWaitMs, request.signal);
            if (wake === 'superseded' || wake === 'aborted')
                return jsonResponse(EMPTY_BATCH);
            const lateRejection = this.rejectPeer(batch.peer);
            if (lateRejection)
                return lateRejection;
            this.link.touch();
        }
        return jsonResponse(this.queue.takeBatch());
    }
    private acceptResults(body: unknown): Response {
        const batch = parseResultBatch(body);
        if (!batch)
            return bridgeError('BAD_REQUEST', 'Malformed results.', 400);
        const rejection = this.rejectPeer(batch.peer);
        if (rejection)
            return rejection;
        this.link.touch();
        return jsonResponse({ accepted: this.queue.settle(batch.results) });
    }
    private bye(body: unknown): Response {
        const bye = parseByeRequest(body);
        if (!bye)
            return bridgeError('BAD_REQUEST', 'Malformed bye.', 400);
        if (this.link.release(bye.peer)) {
            this.queue.abandonAll();
            this.gate.release();
        }
        return jsonResponse({ released: true });
    }
    private async handleFile(request: Request, target: string | undefined): Promise<Response> {
        if (request.method === 'GET') {
            const file = target ? this.files.get(target) : undefined;
            return file ? fileResponse(file.bytes, file.mimeType, file.name) : bridgeError('FILE_NOT_FOUND', 'The file does not exist or has expired. Upload it again.', 404);
        }
        if (request.method !== 'PUT')
            return methodNotAllowed('GET, PUT');
        const bytes = await readBytes(request, FILE_LIMIT_BYTES);
        return jsonResponse(describeFile(this.files.put(target ?? '', request.headers.get('content-type') ?? '', bytes)));
    }
    private rejectPeer(peer: string): Response | null {
        switch (this.link.standingOf(peer)) {
            case 'current':
                return null;
            case 'replaced':
                return bridgeError('PEER_REPLACED', 'Another editor tab took over this MCP session.', 409);
            case 'unknown':
                return bridgeError('UNKNOWN_PEER', 'The Worker does not know this editor. Say hello again.', 409);
        }
    }
}
