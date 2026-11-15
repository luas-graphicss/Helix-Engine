const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';
type Phase = 'opening' | 'thinking' | 'answering';
export interface SplitTextSink {
    onText(text: string): void;
    onReasoning(text: string): void;
}
function partialTagLength(text: string, tag: string): number {
    for (let length = Math.min(tag.length - 1, text.length); length > 0; length--) {
        if (tag.startsWith(text.slice(-length)))
            return length;
    }
    return 0;
}
export class ThinkTagSplitter {
    private phase: Phase = 'opening';
    private held = '';
    constructor(private readonly sink: SplitTextSink) { }
    push(chunk: string): void {
        if (!chunk)
            return;
        if (this.phase === 'answering') {
            this.sink.onText(chunk);
            return;
        }
        const text = `${this.held}${chunk}`;
        this.held = '';
        if (this.phase === 'opening')
            this.readOpening(text);
        else
            this.readThinking(text);
    }
    flush(): void {
        const rest = this.held;
        this.held = '';
        if (!rest)
            return;
        if (this.phase === 'thinking')
            this.sink.onReasoning(rest);
        else
            this.sink.onText(rest);
    }
    private readOpening(text: string): void {
        const lead = text.trimStart();
        if (lead.startsWith(OPEN_TAG)) {
            this.phase = 'thinking';
            this.readThinking(lead.slice(OPEN_TAG.length));
            return;
        }
        if (OPEN_TAG.startsWith(lead)) {
            this.held = text;
            return;
        }
        this.phase = 'answering';
        this.sink.onText(text);
    }
    private readThinking(text: string): void {
        const end = text.indexOf(CLOSE_TAG);
        const heldLength = end === -1 ? partialTagLength(text, CLOSE_TAG) : 0;
        const reasoning = end === -1 ? text.slice(0, text.length - heldLength) : text.slice(0, end);
        if (reasoning)
            this.sink.onReasoning(reasoning);
        if (end === -1) {
            this.held = text.slice(text.length - heldLength);
            return;
        }
        this.phase = 'answering';
        const answer = text.slice(end + CLOSE_TAG.length);
        if (answer)
            this.sink.onText(answer);
    }
}
