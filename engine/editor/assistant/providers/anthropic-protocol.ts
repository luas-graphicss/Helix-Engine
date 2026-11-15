import { ANTHROPIC_PROTOCOL_ID, AnthropicMessageReader } from './anthropic-message-reader';
import type { AssistantMessage, ChatMessage, ChatProtocol, ProviderEndpoint } from './chat-protocol';
import { textOf, type JsonRecord } from './json-value';
import { readModelIds } from './model-list';
import { requestJson, resolveEndpointUrl } from './provider-http';
import { streamJsonEvents } from './provider-stream';
const API_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 16000;
const MODEL_PAGE_SIZE = 1000;
interface WireMessage {
    role: 'user' | 'assistant';
    content: JsonRecord[];
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
function isSendable(block: JsonRecord): boolean {
    return block.type !== 'text' || textOf(block.text).trim() !== '';
}
function assistantContent(message: AssistantMessage): JsonRecord[] {
    if (message.native?.protocol === ANTHROPIC_PROTOCOL_ID)
        return message.native.content.filter(isSendable);
    const content: JsonRecord[] = message.text.trim() ? [{ type: 'text', text: message.text }] : [];
    for (const call of message.toolCalls)
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
    return content;
}
function toWireMessages(messages: readonly ChatMessage[]): WireMessage[] {
    const wire: WireMessage[] = [];
    for (const message of messages) {
        switch (message.role) {
            case 'user':
                wire.push({ role: 'user', content: [{ type: 'text', text: message.text }] });
                break;
            case 'assistant': {
                const content = assistantContent(message);
                if (content.length > 0)
                    wire.push({ role: 'assistant', content });
                break;
            }
            case 'tool': {
                const block: JsonRecord = { type: 'tool_result', tool_use_id: message.callId, content: message.output, is_error: message.failed };
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
export const anthropicProtocol: ChatProtocol = {
    async complete({ endpoint, system, messages, tools, signal, observer }) {
        const reader = new AnthropicMessageReader(observer);
        const events = streamJsonEvents(resolveEndpointUrl(endpoint.baseUrl, 'messages'), {
            method: 'POST',
            headers: requestHeaders(endpoint),
            signal,
            body: {
                model: endpoint.model,
                max_tokens: MAX_OUTPUT_TOKENS,
                system,
                messages: toWireMessages(messages),
                tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
                stream: true,
            },
        });
        for await (const event of events)
            reader.accept(event);
        return reader.finish();
    },
    async listModels(endpoint, signal) {
        const url = resolveEndpointUrl(endpoint.baseUrl, 'models');
        url.searchParams.set('limit', String(MODEL_PAGE_SIZE));
        return readModelIds(await requestJson(url, { method: 'GET', headers: requestHeaders(endpoint), signal }));
    },
};
