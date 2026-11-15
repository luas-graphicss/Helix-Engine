import type { ChatMessage, ChatProtocol, ModelTurn, ProviderEndpoint, ToolCall } from './chat-protocol';
import { isRecord, recordsOf } from './json-value';
import { readModelIds } from './model-list';
import { ProviderError, requestJson, resolveEndpointUrl } from './provider-http';
const API_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 8192;
const MODEL_PAGE_SIZE = 1000;
type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: Readonly<Record<string, unknown>>;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error: boolean;
};
interface WireMessage {
    role: 'user' | 'assistant';
    content: ContentBlock[];
}
function requestHeaders(endpoint: ProviderEndpoint): Record<string, string> {
    return {
        'content-type': 'application/json',
        'x-api-key': endpoint.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
    };
}
function collectsToolResults(message: WireMessage | undefined): message is WireMessage {
    return message !== undefined && message.role === 'user' && message.content.every((block) => block.type === 'tool_result');
}
function toWireMessages(messages: readonly ChatMessage[]): WireMessage[] {
    const wire: WireMessage[] = [];
    for (const message of messages) {
        switch (message.role) {
            case 'user':
                wire.push({ role: 'user', content: [{ type: 'text', text: message.text }] });
                break;
            case 'assistant': {
                const content: ContentBlock[] = message.text ? [{ type: 'text', text: message.text }] : [];
                for (const call of message.toolCalls)
                    content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
                if (content.length > 0)
                    wire.push({ role: 'assistant', content });
                break;
            }
            case 'tool': {
                const block: ContentBlock = { type: 'tool_result', tool_use_id: message.callId, content: message.output, is_error: message.failed };
                const last = wire.at(-1);
                if (collectsToolResults(last))
                    last.content.push(block);
                else
                    wire.push({ role: 'user', content: [block] });
                break;
            }
        }
    }
    return wire;
}
function readTurn(payload: unknown): ModelTurn {
    if (!isRecord(payload) || !Array.isArray(payload.content))
        throw new ProviderError('A API Anthropic respondeu sem conteúdo.', null);
    let text = '';
    const toolCalls: ToolCall[] = [];
    for (const block of recordsOf(payload.content)) {
        if (block.type === 'text' && typeof block.text === 'string')
            text += block.text;
        else if (block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string')
            toolCalls.push({ id: block.id, name: block.name, input: isRecord(block.input) ? block.input : {}, inputError: null });
    }
    return { text, toolCalls, truncated: payload.stop_reason === 'max_tokens' };
}
export const anthropicProtocol: ChatProtocol = {
    async complete({ endpoint, system, messages, tools, signal }) {
        const payload = await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'messages'), {
            method: 'POST',
            headers: requestHeaders(endpoint),
            signal,
            body: {
                model: endpoint.model,
                max_tokens: MAX_OUTPUT_TOKENS,
                system,
                messages: toWireMessages(messages),
                tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
            },
        });
        return readTurn(payload);
    },
    async listModels(endpoint, signal) {
        const url = resolveEndpointUrl(endpoint.baseUrl, 'models');
        url.searchParams.set('limit', String(MODEL_PAGE_SIZE));
        return readModelIds(await requestJson(url, { method: 'GET', headers: requestHeaders(endpoint), signal }));
    },
};
