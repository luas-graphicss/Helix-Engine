import type { TurnObserver } from '@/engine/editor/assistant/providers/chat-protocol';
const FLUSH_INTERVAL_MS = 50;
export class DeltaBuffer implements TurnObserver {
    private pendingText = '';
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    constructor(private readonly target: TurnObserver) { }
    onText(delta: string): void {
        this.pendingText += delta;
        this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
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
        if (!this.pendingText)
            return;
        const text = this.pendingText;
        this.pendingText = '';
        this.target.onText(text);
    }
}
