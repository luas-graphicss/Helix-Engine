import type { TurnObserver } from '@/engine/editor/assistant/providers/chat-protocol';
const FLUSH_INTERVAL_MS = 50;
type DeltaKind = 'text' | 'reasoning';
interface PendingDelta {
    readonly kind: DeltaKind;
    text: string;
}
export class DeltaBuffer implements TurnObserver {
    private pending: PendingDelta[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    constructor(private readonly target: TurnObserver) { }
    onText(delta: string): void {
        this.enqueue('text', delta);
    }
    onReasoning(delta: string): void {
        this.enqueue('reasoning', delta);
    }
    onToolCall(name: string): void {
        this.flush();
        this.target.onToolCall(name);
    }
    flush(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        const deltas = this.pending;
        this.pending = [];
        for (const delta of deltas) {
            if (delta.kind === 'text')
                this.target.onText(delta.text);
            else
                this.target.onReasoning(delta.text);
        }
    }
    private enqueue(kind: DeltaKind, text: string): void {
        const last = this.pending.at(-1);
        if (last?.kind === kind)
            last.text += text;
        else
            this.pending.push({ kind, text });
        this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    }
}
