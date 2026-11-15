import type { ChatMessage, ChatProtocol, ToolCall } from './chat-protocol';
import { isRecord, recordsOf, textOf, type JsonRecord } from './json-value';
import { readModelIds } from './model-list';
import { bearerHeaders } from './openai-headers';
import { requestJson, resolveEndpointUrl } from './provider-http';
import { streamJsonEvents } from './provider-stream';
import { TurnAssembler } from './turn-assembler';
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
        .map((part) => textOf(part.text))
        .join('');
}
function readToolCallFragment(assembler: TurnAssembler, fragment: JsonRecord): void {
    const index = typeof fragment.index === 'number' ? fragment.index : 0;
    const target = isRecord(fragment.function) ? fragment.function : {};
    const id = textOf(fragment.id);
    const name = textOf(target.name);
    if (name && !assembler.isOpenToolCall(index, id))
        assembler.openToolCall(index, id, name);
    assembler.appendToolArguments(index, textOf(target.arguments));
}
export const openAiChatProtocol: ChatProtocol = {
    async complete({ endpoint, system, messages, tools, signal, observer }) {
        const assembler = new TurnAssembler(observer);
        const systemMessage: WireMessage = { role: 'system', content: system };
        const chunks = streamJsonEvents(resolveEndpointUrl(endpoint.baseUrl, 'chat/completions'), {
            method: 'POST',
            headers: bearerHeaders(endpoint),
            signal,
            body: {
                model: endpoint.model,
                messages: [systemMessage, ...messages.map(toWireMessage)],
                tools: tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
                stream: true,
            },
        });
        let truncated = false;
        for await (const chunk of chunks) {
            const choice = recordsOf(chunk.choices).at(0);
            if (!choice)
                continue;
            truncated ||= choice.finish_reason === 'length';
            if (!isRecord(choice.delta))
                continue;
            assembler.appendText(readContent(choice.delta.content));
            for (const fragment of recordsOf(choice.delta.tool_calls))
                readToolCallFragment(assembler, fragment);
        }
        return assembler.assemble(truncated);
    },
    async listModels(endpoint, signal) {
        return readModelIds(await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'models'), { method: 'GET', headers: bearerHeaders(endpoint), signal }));
    },
};
