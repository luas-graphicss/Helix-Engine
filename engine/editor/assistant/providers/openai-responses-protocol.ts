import type { ChatMessage, ChatProtocol } from './chat-protocol';
import { isRecord, textOf, type JsonRecord } from './json-value';
import { readModelIds } from './model-list';
import { bearerHeaders } from './openai-headers';
import { requestJson, resolveEndpointUrl, streamFailure } from './provider-http';
import { streamJsonEvents } from './provider-stream';
import { TurnAssembler } from './turn-assembler';
const SUMMARY_PART_BREAK = '\n\n';
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
function readFunctionCall(assembler: TurnAssembler, event: JsonRecord): void {
    const { item, output_index: index } = event;
    if (typeof index !== 'number' || !isRecord(item) || item.type !== 'function_call')
        return;
    const callId = textOf(item.call_id);
    if (!callId)
        return;
    if (!assembler.isOpenToolCall(index, callId))
        assembler.openToolCall(index, callId, textOf(item.name));
    if (event.type === 'response.output_item.done')
        assembler.setToolArguments(index, textOf(item.arguments));
}
function stoppedAtOutputLimit(response: unknown): boolean {
    return isRecord(response) && isRecord(response.incomplete_details) && response.incomplete_details.reason === 'max_output_tokens';
}
export const openAiResponsesProtocol: ChatProtocol = {
    async complete({ endpoint, system, messages, tools, signal, reasoningEffort, observer }) {
        const assembler = new TurnAssembler(observer);
        const url = resolveEndpointUrl(endpoint.baseUrl, 'responses');
        const events = streamJsonEvents(url, {
            method: 'POST',
            headers: bearerHeaders(endpoint),
            signal,
            body: {
                model: endpoint.model,
                instructions: system,
                input: toInputItems(messages),
                tools: tools.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters, strict: false })),
                store: false,
                stream: true,
                ...(reasoningEffort === 'auto' ? {} : { reasoning: { effort: reasoningEffort, summary: 'auto' } }),
            },
        });
        let truncated = false;
        for await (const event of events) {
            switch (event.type) {
                case 'response.output_text.delta':
                case 'response.refusal.delta':
                    assembler.appendText(textOf(event.delta));
                    break;
                case 'response.reasoning_summary_text.delta':
                case 'response.reasoning_text.delta':
                    assembler.appendReasoning(textOf(event.delta));
                    break;
                case 'response.reasoning_summary_part.added':
                    if (typeof event.summary_index === 'number' && event.summary_index > 0)
                        assembler.appendReasoning(SUMMARY_PART_BREAK);
                    break;
                case 'response.output_item.added':
                case 'response.output_item.done':
                    readFunctionCall(assembler, event);
                    break;
                case 'response.function_call_arguments.delta':
                    if (typeof event.output_index === 'number')
                        assembler.appendToolArguments(event.output_index, textOf(event.delta));
                    break;
                case 'response.incomplete':
                    truncated = stoppedAtOutputLimit(event.response);
                    break;
                case 'response.failed':
                    throw streamFailure(url, event.response);
            }
        }
        return assembler.assemble(truncated);
    },
    async listModels(endpoint, signal) {
        return readModelIds(await requestJson(resolveEndpointUrl(endpoint.baseUrl, 'models'), { method: 'GET', headers: bearerHeaders(endpoint), signal }));
    },
};
