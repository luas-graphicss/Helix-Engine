import type { ModelTurn, ProtocolId, TurnObserver } from './chat-protocol';
import { isRecord, textOf, type JsonRecord } from './json-value';
import { TurnAssembler } from './turn-assembler';
export const ANTHROPIC_PROTOCOL_ID: ProtocolId = 'anthropic';
function appendTo(block: JsonRecord, field: string, fragment: string): void {
    block[field] = `${textOf(block[field])}${fragment}`;
}
export class AnthropicMessageReader {
    private readonly assembler: TurnAssembler;
    private readonly blocks = new Map<number, JsonRecord>();
    private truncated = false;
    constructor(observer: TurnObserver) {
        this.assembler = new TurnAssembler(observer);
    }
    accept(event: JsonRecord): void {
        if (event.type === 'message_delta') {
            this.truncated ||= isRecord(event.delta) && event.delta.stop_reason === 'max_tokens';
            return;
        }
        if (typeof event.index !== 'number')
            return;
        if (event.type === 'content_block_start' && isRecord(event.content_block))
            this.startBlock(event.index, event.content_block);
        else if (event.type === 'content_block_delta' && isRecord(event.delta))
            this.extendBlock(event.index, event.delta);
    }
    finish(): ModelTurn {
        const turn = this.assembler.assemble(this.truncated);
        const inputs = new Map(turn.toolCalls.map((call) => [call.id, call.input]));
        const content = Array.from(this.blocks.values(), (block) => (block.type === 'tool_use' ? { ...block, input: inputs.get(textOf(block.id)) ?? {} } : block));
        return { ...turn, native: { protocol: ANTHROPIC_PROTOCOL_ID, content } };
    }
    private startBlock(index: number, block: JsonRecord): void {
        this.blocks.set(index, { ...block });
        if (block.type === 'tool_use')
            this.assembler.openToolCall(index, textOf(block.id), textOf(block.name));
        else if (block.type === 'text')
            this.assembler.appendText(textOf(block.text));
    }
    private extendBlock(index: number, delta: JsonRecord): void {
        const block = this.blocks.get(index);
        if (!block)
            return;
        switch (delta.type) {
            case 'text_delta':
                appendTo(block, 'text', textOf(delta.text));
                this.assembler.appendText(textOf(delta.text));
                break;
            case 'thinking_delta':
                appendTo(block, 'thinking', textOf(delta.thinking));
                break;
            case 'signature_delta':
                appendTo(block, 'signature', textOf(delta.signature));
                break;
            case 'input_json_delta':
                this.assembler.appendToolArguments(index, textOf(delta.partial_json));
                break;
        }
    }
}
