import type { GizmoPainter } from '../gizmos/gizmo-painter';
import type { OverlayLayer } from '../overlay/viewport-overlay';
import type { ToolContribution } from './tool-contribution';
export interface ToolHost {
    selectBuiltInTool(): void;
    notifyToolChanged(): void;
}
export interface ToolLookup {
    get(id: string): ToolContribution | null;
}
export class ToolController implements OverlayLayer {
    private activeTool: ToolContribution | null = null;
    constructor(private readonly host: ToolHost, private readonly tools: ToolLookup) { }
    get active(): ToolContribution | null {
        return this.activeTool;
    }
    trigger(tool: ToolContribution): void {
        if (tool.isAction)
            tool.run();
        else if (this.activeTool === tool)
            this.deactivate();
        else
            this.activate(tool);
    }
    activate(tool: ToolContribution): void {
        if (tool.isAction || this.activeTool === tool)
            return;
        this.host.selectBuiltInTool();
        this.release();
        this.adopt(tool);
    }
    deactivate(): boolean {
        if (!this.release())
            return false;
        this.host.notifyToolChanged();
        return true;
    }
    handleRemoved(tool: ToolContribution): void {
        if (this.activeTool !== tool)
            return;
        this.release();
        const replacement = this.tools.get(tool.id);
        if (replacement && replacement !== tool && !replacement.isAction)
            this.adopt(replacement);
        else
            this.host.notifyToolChanged();
    }
    paintInto(painter: GizmoPainter): void {
        this.activeTool?.paint(painter);
    }
    private adopt(tool: ToolContribution): void {
        this.activeTool = tool;
        tool.activate();
        this.host.notifyToolChanged();
    }
    private release(): boolean {
        const tool = this.activeTool;
        if (!tool)
            return false;
        this.activeTool = null;
        tool.deactivate();
        return true;
    }
}
