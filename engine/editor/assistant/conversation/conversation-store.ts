import type { ChatMessage, ModelTurn } from '@/engine/editor/assistant/providers/chat-protocol';
import type { AssistantActivity, ConversationEntry, ConversationSnapshot, NoticeTone, ToolCallEntry } from './conversation-entry';
type Listener = () => void;
export type ToolCallDraft = Omit<ToolCallEntry, 'id' | 'kind'>;
export type ToolCallPatch = Partial<Pick<ToolCallEntry, 'status' | 'output'>>;
interface OpenReasoning {
    readonly id: number;
    readonly startedAt: number;
}
const EMPTY_CONVERSATION: ConversationSnapshot = { entries: [], activity: 'idle' };
export class ConversationStore {
    private snapshot = EMPTY_CONVERSATION;
    private messages: ChatMessage[] = [];
    private nextId = 1;
    private turnText = '';
    private unopenedText = '';
    private openTextId: number | null = null;
    private unopenedReasoning = '';
    private openReasoning: OpenReasoning | null = null;
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
    appendReasoning(delta: string): void {
        this.openTextId = null;
        this.unopenedText = '';
        const open = this.openReasoning;
        if (!open) {
            this.startReasoning(delta);
            return;
        }
        const entries = this.snapshot.entries.map((entry) => (entry.id === open.id && entry.kind === 'reasoning' ? { ...entry, text: `${entry.text}${delta}` } : entry));
        this.publish({ entries, activity: 'responding' });
    }
    beginToolCall(): void {
        this.publish({ entries: this.settleReasoning(), activity: 'preparing' });
    }
    commitAssistantTurn(turn: ModelTurn): void {
        this.messages.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, native: turn.native });
        this.closeTurn(this.snapshot.activity);
    }
    endRun(): void {
        if (this.turnText.trim())
            this.messages.push({ role: 'assistant', text: this.turnText, toolCalls: [], native: null });
        this.closeTurn('idle');
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
        this.openReasoning = null;
        this.resetTurn();
        this.publish(EMPTY_CONVERSATION);
    }
    private openText(delta: string): void {
        this.unopenedText += delta;
        const text = this.unopenedText.trimStart();
        if (!text)
            return;
        this.unopenedText = '';
        this.openTextId = this.nextId++;
        this.publish({ entries: [...this.settleReasoning(), { id: this.openTextId, kind: 'assistant', text }], activity: 'responding' });
    }
    private startReasoning(delta: string): void {
        this.unopenedReasoning += delta;
        const text = this.unopenedReasoning.trimStart();
        if (!text)
            return;
        this.unopenedReasoning = '';
        this.openReasoning = { id: this.nextId++, startedAt: Date.now() };
        this.publish({ entries: [...this.snapshot.entries, { id: this.openReasoning.id, kind: 'reasoning', text, durationMs: null }], activity: 'responding' });
    }
    private settleReasoning(): readonly ConversationEntry[] {
        const open = this.openReasoning;
        this.openReasoning = null;
        this.unopenedReasoning = '';
        if (!open)
            return this.snapshot.entries;
        const durationMs = Date.now() - open.startedAt;
        return this.snapshot.entries.map((entry) => (entry.id === open.id && entry.kind === 'reasoning' ? { ...entry, durationMs } : entry));
    }
    private closeTurn(activity: AssistantActivity): void {
        const entries = this.settleReasoning();
        this.resetTurn();
        if (entries !== this.snapshot.entries || activity !== this.snapshot.activity)
            this.publish({ entries, activity });
    }
    private resetTurn(): void {
        this.turnText = '';
        this.unopenedText = '';
        this.openTextId = null;
        this.unopenedReasoning = '';
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
