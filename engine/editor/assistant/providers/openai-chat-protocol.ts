import type { ChatMessage, ChatProtocol, ModelTurn, ToolCall } from './chat-protocol';
import { isRecord, recordsOf } from './json-value';
import { readModelIds } from './model-list';
import { bearerHeaders } from './openai-headers';
import { ProviderError, requestJson, resolveEndpointUrl } from './provider-http';
import { parseToolCallInput } from './tool-call-input';
interface WireToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
type WireMessage = {
    role: 'system' | 'user';
    content: string;
} | {
    role: 'assistant';
    content: string | null;
    tool_calls?: WireToolCall[];
} | {
    role: 'tool';
    tool_call_id: string;
    content: string;
};
function toWireToolCall(call: ToolCall): WireToolCall {
    return { id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.input) } };
}
function toWireMessage(message: ChatMessage): WireMessage {
    switch (message.role) {
        case 'user':
            return { role: 'user', content: message.text };
        case 'assistant':
            return message.toolCalls.length === 0
                ? { role: 'assistant', content: message.text }
                : { role: 'assistant', content: message.text || null, tool_calls: message.toolCalls.map(toWireToolCall) };
        case 'tool':
            return { role: 'tool', tool_call_id: message.callId, content: message.output };
    }
}
function readContent(content: unknown): string {
    if (typeof content === 'string')
        return content;
    return recordsOf(content)
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
}
function readToolCalls(value: unknown): ToolCall[] {
    return recordsOf(value).flatMap((call) => {
        const target = call.function;
        if (!isRecord(target) || typeof target.name !== 'string')
            return [];
        const id = typeof call.id === 'string' && call.id ? call.id : `call_${crypto.randomUUID()}`;
        return [{ id, name: target.name, ...parseToolCallInput(target.arguments) }];
    });
}
function readTurn(payload: unknown): ModelTurn {
    const choice = isRecord(payload) ? recordsOf(payload.choices).at(0) : undefined;
    const message = choice?.message;
    if (!choice || !isRecord(message))
        throw new ProviderError('O provedor respondeu sem nenhuma mensagem.', null);
    return { text: readContent(message.content), toolCalls: readToolCalls(message.tool_calls), truncated: choice.finish_reason === 'length' };
}
export const openAiChatProtocol: ChatProtocol = {
    async complete({ endpoint, system, messages, tools, signal }) {
        const systemMessage: WireMessage = { role: 'system', content: system };
        const payload = await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'chat/completions'), {
            method: 'POST',
            headers: bearerHeaders(endpoint),
            signal,
            body: {
                model: endpoint.model,
                messages: [systemMessage, ...messages.map(toWireMessage)],
                tools: tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
            },
        });
        return readTurn(payload);
    },
    async listModels(endpoint, signal) {
        return readModelIds(await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'models'), { method: 'GET', headers: bearerHeaders(endpoint), signal }));
    },
};
