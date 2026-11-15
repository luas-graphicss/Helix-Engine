import { fileResponse, jsonResponse, methodNotAllowed, textResponse } from '@/engine/mcp/worker/http/http-responses';
import { readBytes } from '@/engine/mcp/worker/http/request-body';
import { describeFile, FILE_LIMIT_BYTES, type FileStore } from '@/engine/mcp/worker/session/file-store';
import type { SessionOverview } from '@/engine/mcp/worker/session/session-overview';
import { readAgentContext, type AgentContext } from './agent-context';
import { renderHelp } from './agent-guide';
import { readCallArguments } from './call-arguments';
import { McpServer } from './mcp-server';
import { renderReplyJson, renderReplyText } from './reply-rendering';
import { renderCli } from './terminal-cli';
import { renderToolDetails, renderToolList } from './terminal-text';
import type { ToolDispatcher } from './tool-dispatcher';
import { httpStatusOf, type ToolReply } from './tool-reply';
const CLI_CONTENT_TYPE = 'text/x-shellscript; charset=utf-8';
const EVENT_STREAM_TYPE = 'text/event-stream';
function wantsJson(url: URL): boolean {
    return url.searchParams.get('format') === 'json';
}
function wantsOnlyEventStream(request: Request): boolean {
    const accept = request.headers.get('accept') ?? '';
    return accept.includes(EVENT_STREAM_TYPE) && !accept.includes('*/*') && !accept.includes('text/plain');
}
function isRead(request: Request): boolean {
    return request.method === 'GET' || request.method === 'HEAD';
}
export class AgentRouter {
    private readonly mcp: McpServer;
    constructor(private readonly dispatcher: ToolDispatcher, private readonly files: FileStore, private readonly describeSession: () => SessionOverview) {
        this.mcp = new McpServer(dispatcher, files);
    }
    async handle(request: Request, url: URL, baseUrl: string, path: readonly string[]): Promise<Response> {
        const context = readAgentContext(request, url, baseUrl);
        const [resource, target] = path;
        switch (resource) {
            case undefined:
                return this.handleEndpoint(request, context);
            case 'cli':
                return textResponse(renderCli(baseUrl), 200, CLI_CONTENT_TYPE);
            case 'tools':
                return this.describeTools(url, target);
            case 'call':
                return this.callTool(request, url, context, target);
            case 'files':
                return this.handleFile(request, url, target);
            default:
                return textResponse(`Unknown path "${resource}". GET ${baseUrl} lists the routes.\n`, 404);
        }
    }
    private handleEndpoint(request: Request, context: AgentContext): Response | Promise<Response> {
        if (request.method === 'POST')
            return this.mcp.handle(request, context);
        if (!isRead(request))
            return methodNotAllowed('GET, POST');
        if (wantsOnlyEventStream(request))
            return methodNotAllowed('POST');
        return textResponse(renderHelp(context.baseUrl, this.describeSession()));
    }
    private describeTools(url: URL, target: string | undefined): Response {
        if (target === undefined) {
            const tools = this.dispatcher.listTools();
            return wantsJson(url) ? jsonResponse({ tools }) : textResponse(`${renderToolList(tools)}\n`);
        }
        const tool = this.dispatcher.findTool(target);
        if (!tool)
            return textResponse(`There is no tool named "${target}".\n`, 404);
        return wantsJson(url) ? jsonResponse(tool) : textResponse(`${renderToolDetails(tool)}\n`);
    }
    private async callTool(request: Request, url: URL, context: AgentContext, target: string | undefined): Promise<Response> {
        if (request.method !== 'POST')
            return methodNotAllowed('POST');
        if (target === undefined)
            return textResponse('Name the tool: POST /call/<tool>.\n', 400);
        const reply = await this.dispatcher.call(target, await readCallArguments(request), context);
        if (url.searchParams.get('output') === 'file')
            return this.respondWithAttachment(reply, context);
        const status = httpStatusOf(reply);
        return wantsJson(url) ? jsonResponse(renderReplyJson(reply, context.baseUrl), status) : textResponse(`${renderReplyText(reply, context.baseUrl)}\n`, status);
    }
    private respondWithAttachment(reply: ToolReply, context: AgentContext): Response {
        if (reply.failed)
            return textResponse(`${renderReplyText(reply, context.baseUrl)}\n`, httpStatusOf(reply));
        const [attachment] = reply.attachments;
        const file = attachment ? this.files.get(attachment.fileId) : undefined;
        return file ? fileResponse(file.bytes, file.mimeType, file.name) : textResponse('The tool returned no file.\n', 404);
    }
    private async handleFile(request: Request, url: URL, target: string | undefined): Promise<Response> {
        if (isRead(request)) {
            const file = target ? this.files.get(target) : undefined;
            return file ? fileResponse(file.bytes, file.mimeType, file.name) : textResponse('The file does not exist or has expired. Upload it again.\n', 404);
        }
        if (request.method !== 'PUT' && request.method !== 'POST')
            return methodNotAllowed('GET, PUT');
        const bytes = await readBytes(request, FILE_LIMIT_BYTES);
        if (bytes.byteLength === 0)
            return textResponse('The upload is empty.\n', 400);
        const file = describeFile(this.files.put(target ?? '', request.headers.get('content-type') ?? '', bytes));
        if (wantsJson(url))
            return jsonResponse(file);
        return textResponse(`${file.fileId}\n${file.name}: ${file.size} bytes, ${file.mimeType}. Pass the id to import_model, import_asset or apply_texture.\n`);
    }
}
