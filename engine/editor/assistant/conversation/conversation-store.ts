import type { ChatMessage, ModelTurn } from '@/engine/editor/assistant/providers/chat-protocol';
import type { AssistantActivity, ConversationEntry, ConversationSnapshot, NoticeTone, ToolCallEntry } from './conversation-entry';
type Listener = () => void;
export type ToolCallDraft = Omit<ToolCallEntry, 'id' | 'kind'>;
export type ToolCallPatch = Partial<Pick<ToolCallEntry, 'status' | 'output'>>;
const EMPTY_CONVERSATION: ConversationSnapshot = { entries: [], activity: 'idle' };
export class ConversationStore {
    private snapshot = EMPTY_CONVERSATION;
    private messages: ChatMessage[] = [];
    private nextId = 1;
    private turnText = '';
    private unopenedText = '';
    private openTextId: number | null = null;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): ConversationSnapshot => this.snapshot;
    get transcript(): readonly ChatMessage[] {
        return this.messages;
    }
    setActivity(activity: AssistantActivity): void {
        if (activity !== this.snapshot.activity)
            this.publish({ ...this.snapshot, activity });
    }
    addUserMessage(text: string): void {
        this.messages.push({ role: 'user', text });
        this.append({ id: this.nextId++, kind: 'user', text });
    }
    appendAssistantText(delta: string): void {
        this.turnText += delta;
        const openId = this.openTextId;
        if (openId === null) {
            this.openText(delta);
            return;
        }
        const entries = this.snapshot.entries.map((entry) => (entry.id === openId && entry.kind === 'assistant' ? { ...entry, text: `${entry.text}${delta}` } : entry));
        this.publish({ entries, activity: 'responding' });
    }
    commitAssistantTurn(turn: ModelTurn): void {
        this.messages.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, native: turn.native });
        this.closeTurn();
    }
    endRun(): void {
        if (this.turnText.trim())
            this.messages.push({ role: 'assistant', text: this.turnText, toolCalls: [], native: null });
        this.closeTurn();
        this.setActivity('idle');
    }
    addToolResult(callId: string, output: string, failed: boolean): void {
        this.messages.push({ role: 'tool', callId, output, failed });
    }
    addNotice(tone: NoticeTone, text: string): void {
        this.append({ id: this.nextId++, kind: 'notice', tone, text });
    }
    addToolCall(draft: ToolCallDraft): number {
        const id = this.nextId++;
        this.append({ ...draft, id, kind: 'tool' });
        return id;
    }
    updateToolCall(id: number, patch: ToolCallPatch): void {
        const entries = this.snapshot.entries.map((entry) => (entry.id === id && entry.kind === 'tool' ? { ...entry, ...patch } : entry));
        this.publish({ ...this.snapshot, entries });
    }
    clear(): void {
        this.messages = [];
        this.closeTurn();
        this.publish(EMPTY_CONVERSATION);
    }
    private openText(delta: string): void {
        this.unopenedText += delta;
        const text = this.unopenedText.trimStart();
        if (!text)
            return;
        this.unopenedText = '';
        this.openTextId = this.nextId++;
        this.publish({ entries: [...this.snapshot.entries, { id: this.openTextId, kind: 'assistant', text }], activity: 'responding' });
    }
    private closeTurn(): void {
        this.turnText = '';
        this.unopenedText = '';
        this.openTextId = null;
    }
    private append(entry: ConversationEntry): void {
        this.publish({ ...this.snapshot, entries: [...this.snapshot.entries, entry] });
    }
    private publish(snapshot: ConversationSnapshot): void {
        this.snapshot = snapshot;
        for (const listener of this.listeners)
            listener();
    }
}
