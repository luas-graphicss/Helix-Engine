import { ENGINE_VERSION } from '@/engine/core/engine-info';
import { isFiniteNumber, isRecord, isText, type JsonRecord } from '@/engine/mcp/protocol/json-shape';
import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import { emptyResponse, jsonResponse } from '@/engine/mcp/worker/http/http-responses';
import { readJson, RequestBodyError } from '@/engine/mcp/worker/http/request-body';
import type { FileStore } from '@/engine/mcp/worker/session/file-store';
import type { AgentContext } from './agent-context';
import { AGENT_INSTRUCTIONS } from './agent-guide';
import { renderMcpContent } from './reply-rendering';
import type { ToolDispatcher } from './tool-dispatcher';
const RPC_BODY_LIMIT_BYTES = 4 * 1024 * 1024;
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
const SERVER_NAME = 'helix-engine-mcp';
const RPC_ERROR = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601 } as const;
type RpcId = string | number | null;
interface RpcCall {
    readonly id: RpcId | undefined;
    readonly method: string;
    readonly params: JsonRecord;
}
function isRpcId(value: unknown): value is RpcId {
    return value === null || isText(value) || isFiniteNumber(value);
}
function parseRpcCall(value: unknown): RpcCall | null {
    if (!isRecord(value))
        return null;
    const { jsonrpc, method, id } = value;
    if (jsonrpc !== '2.0' || !isText(method))
        return null;
    const params = isRecord(value.params) ? value.params : {};
    if (id === undefined)
        return { id: undefined, method, params };
    return isRpcId(id) ? { id, method, params } : null;
}
function rpcResult(id: RpcId, result: object): object {
    return { jsonrpc: '2.0', id, result };
}
function rpcError(id: RpcId, code: number, message: string): object {
    return { jsonrpc: '2.0', id, error: { code, message } };
}
function describeTool(tool: ToolDescriptor): object {
    return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, readOnlyHint: tool.access === 'read', destructiveHint: tool.access === 'destructive' },
    };
}
function initialize(params: JsonRecord): object {
    const protocolVersion = PROTOCOL_VERSIONS.find((version) => version === params.protocolVersion) ?? PROTOCOL_VERSIONS[0];
    return {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, title: 'Helix Engine', version: ENGINE_VERSION },
        instructions: AGENT_INSTRUCTIONS,
    };
}
export class McpServer {
    constructor(private readonly dispatcher: ToolDispatcher, private readonly files: FileStore) { }
    async handle(request: Request, context: AgentContext): Promise<Response> {
        const payload = await this.readPayload(request);
        if (payload === undefined)
            return jsonResponse(rpcError(null, RPC_ERROR.parse, 'Parse error'), 400);
        const answers: object[] = [];
        for (const message of Array.isArray(payload) ? payload : [payload]) {
            const answer = await this.answer(message, context);
            if (answer)
                answers.push(answer);
        }
        if (answers.length === 0)
            return emptyResponse(202);
        return jsonResponse(Array.isArray(payload) ? answers : answers[0]);
    }
    private async readPayload(request: Request): Promise<unknown> {
        try {
            return await readJson(request, RPC_BODY_LIMIT_BYTES);
        }
        catch (cause) {
            if (cause instanceof RequestBodyError)
                return undefined;
            throw cause;
        }
    }
    private async answer(message: unknown, context: AgentContext): Promise<object | null> {
        const call = parseRpcCall(message);
        if (!call)
            return rpcError(null, RPC_ERROR.invalidRequest, 'Invalid Request');
        if (call.id === undefined)
            return null;
        switch (call.method) {
            case 'initialize':
                return rpcResult(call.id, initialize(call.params));
            case 'ping':
                return rpcResult(call.id, {});
            case 'tools/list':
                return rpcResult(call.id, { tools: this.dispatcher.listTools().map(describeTool) });
            case 'tools/call':
                return rpcResult(call.id, await this.callTool(call.params, context));
            default:
                return rpcError(call.id, RPC_ERROR.methodNotFound, `Method not found: ${call.method}`);
        }
    }
    private async callTool(params: JsonRecord, context: AgentContext): Promise<object> {
        const { name } = params;
        const reply = await this.dispatcher.call(isText(name) ? name : '', params.arguments, context);
        return { content: renderMcpContent(reply, context.baseUrl, this.files), isError: reply.failed };
    }
}
