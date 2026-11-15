import type { ChatMessage, ChatProtocol, ModelTurn, ToolCall } from './chat-protocol';
import { isRecord, recordsOf, type JsonRecord } from './json-value';
import { readModelIds } from './model-list';
import { bearerHeaders } from './openai-headers';
import { ProviderError, requestJson, resolveEndpointUrl } from './provider-http';
import { parseToolCallInput } from './tool-call-input';
type InputItem = {
    role: 'user' | 'assistant';
    content: string;
} | {
    type: 'function_call';
    call_id: string;
    name: string;
    arguments: string;
} | {
    type: 'function_call_output';
    call_id: string;
    output: string;
};
function toInputItems(messages: readonly ChatMessage[]): InputItem[] {
    const items: InputItem[] = [];
    for (const message of messages) {
        switch (message.role) {
            case 'user':
                items.push({ role: 'user', content: message.text });
                break;
            case 'assistant':
                if (message.text)
                    items.push({ role: 'assistant', content: message.text });
                for (const call of message.toolCalls)
                    items.push({ type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.input) });
                break;
            case 'tool':
                items.push({ type: 'function_call_output', call_id: message.callId, output: message.output });
                break;
        }
    }
    return items;
}
function readPartText(part: JsonRecord): string {
    if (part.type === 'output_text' && typeof part.text === 'string')
        return part.text;
    return part.type === 'refusal' && typeof part.refusal === 'string' ? part.refusal : '';
}
function readTurn(payload: unknown): ModelTurn {
    if (!isRecord(payload) || !Array.isArray(payload.output))
        throw new ProviderError('O provedor respondeu sem nenhuma saída.', null);
    let text = '';
    const toolCalls: ToolCall[] = [];
    for (const item of recordsOf(payload.output)) {
        if (item.type === 'message')
            text += recordsOf(item.content).map(readPartText).join('');
        else if (item.type === 'function_call' && typeof item.call_id === 'string' && typeof item.name === 'string')
            toolCalls.push({ id: item.call_id, name: item.name, ...parseToolCallInput(item.arguments) });
    }
    const details = payload.incomplete_details;
    const truncated = payload.status === 'incomplete' && isRecord(details) && details.reason === 'max_output_tokens';
    return { text, toolCalls, truncated };
}
export const openAiResponsesProtocol: ChatProtocol = {
    async complete({ endpoint, system, messages, tools, signal }) {
        const payload = await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'responses'), {
            method: 'POST',
            headers: bearerHeaders(endpoint),
            signal,
            body: {
                model: endpoint.model,
                instructions: system,
                input: toInputItems(messages),
                tools: tools.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters, strict: false })),
                store: false,
            },
        });
        return readTurn(payload);
    },
    async listModels(endpoint, signal) {
        return readModelIds(await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'models'), { method: 'GET', headers: bearerHeaders(endpoint), signal }));
    },
};
