import { GuiFrame } from './gui-frame';
import type { GuiNode } from './gui-node';
export type GuiRender = (frame: GuiFrame) => void;
export type GuiRunner = (render: () => void) => boolean;
const MAX_PASSES = 3;
type Listener = () => void;
export class GuiSurface {
    private readonly pending = new Map<string, unknown>();
    private readonly listeners = new Set<Listener>();
    private nodes: readonly GuiNode[] = [];
    private version = 0;
    private failed = false;
    private rendering = false;
    private repaintQueued = false;
    constructor(private readonly render: GuiRender, private readonly run: GuiRunner) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    get tree(): readonly GuiNode[] {
        return this.nodes;
    }
    get hasFailed(): boolean {
        return this.failed;
    }
    dispatch(key: string, value: unknown): void {
        this.pending.set(key, value);
        this.repaint();
    }
    requestRepaint(): void {
        if (this.listeners.size > 0)
            this.repaint();
    }
    refresh(): void {
        if (!this.failed)
            this.repaint();
    }
    repaint(): void {
        if (this.rendering) {
            this.repaintQueued = true;
            return;
        }
        this.rendering = true;
        try {
            this.failed = !this.renderPasses();
        }
        finally {
            this.rendering = false;
            this.pending.clear();
        }
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    private renderPasses(): boolean {
        for (let pass = 0; pass < MAX_PASSES; pass++) {
            this.repaintQueued = false;
            const frame = new GuiFrame(this.pending);
            if (!this.run(() => this.render(frame)))
                return false;
            this.nodes = frame.nodes;
            if (!frame.consumedEvent && !this.repaintQueued)
                break;
        }
        return true;
    }
}
