import { ENGINE_VERSION } from '@/engine/core/engine-info';
import { BRIDGE_PROTOCOL_VERSION, type BridgeErrorBody } from '@/engine/mcp/protocol/bridge-messages';
import { agentEndpoint, BRIDGE_ROUTE } from '@/engine/mcp/protocol/session-address';
import { AgentRouter } from '@/engine/mcp/worker/agent/agent-router';
import { createLocalTools } from '@/engine/mcp/worker/agent/local-tools';
import { ToolDispatcher } from '@/engine/mcp/worker/agent/tool-dispatcher';
import { BridgeRouter } from '@/engine/mcp/worker/bridge/bridge-router';
import { jsonResponse, textResponse } from '@/engine/mcp/worker/http/http-responses';
import { RequestBodyError } from '@/engine/mcp/worker/http/request-body';
import type { DurableObjectState, WorkerEnv } from '@/engine/mcp/worker/runtime/durable-object-types';
import { readWorkerSettings, type WorkerSettings } from '@/engine/mcp/worker/runtime/worker-settings';
import { CallQueue } from './call-queue';
import { EngineLink } from './engine-link';
import { FileStore } from './file-store';
import { PollGate } from './poll-gate';
import type { SessionOverview } from './session-overview';
import { createSessionStats } from './session-stats';
const MILLISECONDS_PER_SECOND = 1000;
const PAYLOAD_TOO_LARGE = 413;
function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    }
    catch {
        return segment;
    }
}
export class EngineSession {
    private readonly settings: WorkerSettings;
    private readonly stats = createSessionStats();
    private readonly gate = new PollGate();
    private readonly link: EngineLink;
    private readonly queue: CallQueue;
    private readonly files: FileStore;
    private readonly dispatcher: ToolDispatcher;
    private readonly bridge: BridgeRouter;
    private readonly agent: AgentRouter;
    private readonly restored: Promise<void>;
    constructor(state: DurableObjectState, env: WorkerEnv) {
        this.settings = readWorkerSettings(env);
        this.link = new EngineLink(state.storage);
        this.queue = new CallQueue(this.settings, this.stats, () => this.gate.release());
        this.files = new FileStore(this.settings.fileTtlMs);
        const describeSession = () => this.describe();
        this.dispatcher = new ToolDispatcher(this.link, this.queue, createLocalTools({ files: this.files, describeSession }), () => this.engineOnline);
        this.bridge = new BridgeRouter(this.link, this.queue, this.gate, this.files, this.settings);
        this.agent = new AgentRouter(this.dispatcher, this.files, describeSession);
        this.restored = state.blockConcurrencyWhile(() => this.link.restore());
    }
    async fetch(request: Request): Promise<Response> {
        await this.restored;
        const url = new URL(request.url);
        const [route, session, token, ...path] = url.pathname.split('/').filter(Boolean).map(decodeSegment);
        const onBridge = route === BRIDGE_ROUTE;
        try {
            return onBridge ? await this.bridge.handle(request, path) : await this.agent.handle(request, url, agentEndpoint(url.origin, { session, token }), path);
        }
        catch (cause) {
            if (!(cause instanceof RequestBodyError))
                throw cause;
            if (!onBridge)
                return textResponse(`${cause.message}\n`, cause.status);
            const code = cause.status === PAYLOAD_TOO_LARGE ? 'BODY_TOO_LARGE' : 'BAD_REQUEST';
            return jsonResponse({ error: { code, message: cause.message } } satisfies BridgeErrorBody, cause.status);
        }
    }
    private get engineOnline(): boolean {
        if (!this.link.connected)
            return false;
        const contactAgeMs = this.link.lastContactAgeMs;
        return this.gate.waiting || (contactAgeMs !== null && contactAgeMs <= this.settings.engineWindowMs);
    }
    private describe(): SessionOverview {
        const { catalog, lastContactAgeMs } = this.link;
        return {
            engineOnline: this.engineOnline,
            project: catalog?.engine.project ?? null,
            engineVersion: catalog?.engine.version ?? null,
            accessMode: catalog?.accessMode ?? null,
            toolCount: this.dispatcher.listTools().length,
            secondsSinceContact: lastContactAgeMs === null ? null : Math.round(lastContactAgeMs / MILLISECONDS_PER_SECOND),
            queue: { waiting: this.queue.waitingCount, running: this.queue.runningCount, limit: this.settings.queueLimit },
            calls: { ...this.stats },
            files: this.files.usage,
            worker: { version: ENGINE_VERSION, bridgeProtocol: BRIDGE_PROTOCOL_VERSION },
        };
    }
}
