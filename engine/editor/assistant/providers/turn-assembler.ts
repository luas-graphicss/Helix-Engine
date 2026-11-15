import type { ModelTurn, ToolCall, TurnObserver } from './chat-protocol';
import { parseToolCallInput } from './tool-call-input';
class ToolCallDraft {
    private argumentsJson = '';
    constructor(readonly id: string, private readonly name: string) { }
    append(fragment: string): void {
        this.argumentsJson += fragment;
    }
    replace(argumentsJson: string): void {
        this.argumentsJson = argumentsJson;
    }
    toToolCall(): ToolCall {
        return { id: this.id || `call_${crypto.randomUUID()}`, name: this.name, ...parseToolCallInput(this.argumentsJson) };
    }
}
export class TurnAssembler {
    private text = '';
    private readonly drafts: ToolCallDraft[] = [];
    private readonly openDrafts = new Map<number, ToolCallDraft>();
    constructor(private readonly observer: TurnObserver) { }
    appendText(delta: string): void {
        if (!delta)
            return;
        this.text += delta;
        this.observer.onText(delta);
    }
    isOpenToolCall(index: number, id: string): boolean {
        return id !== '' && this.openDrafts.get(index)?.id === id;
    }
    openToolCall(index: number, id: string, name: string): void {
        const draft = new ToolCallDraft(id, name);
        this.drafts.push(draft);
        this.openDrafts.set(index, draft);
        this.observer.onToolCall(name);
    }
    appendToolArguments(index: number, fragment: string): void {
        this.openDrafts.get(index)?.append(fragment);
    }
    setToolArguments(index: number, argumentsJson: string): void {
        this.openDrafts.get(index)?.replace(argumentsJson);
    }
    assemble(truncated: boolean): ModelTurn {
        return { text: this.text, toolCalls: this.drafts.map((draft) => draft.toToolCall()), native: null, truncated };
    }
}
