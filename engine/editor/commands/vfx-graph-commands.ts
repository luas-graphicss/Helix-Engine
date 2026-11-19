import type { Command } from '@/engine/editor/history/command';
import type { VfxGraphDocument } from '@/engine/vfx-graph/document/effect-document';
export interface VfxGraphHost {
    restoreGraph(graphId: string, graph: VfxGraphDocument): void;
}
export class SetVfxGraphCommand implements Command {
    readonly scope = 'history' as const;
    readonly image = false;
    constructor(private readonly host: VfxGraphHost, readonly label: string, private readonly graphId: string, private readonly before: VfxGraphDocument, private after: VfxGraphDocument, readonly mergeKey?: string) { }
    execute(): void {
        this.host.restoreGraph(this.graphId, this.after);
    }
    undo(): void {
        this.host.restoreGraph(this.graphId, this.before);
    }
    merge(next: Command): boolean {
        if (!(next instanceof SetVfxGraphCommand) || next.host !== this.host || next.graphId !== this.graphId)
            return false;
        this.after = next.after;
        return true;
    }
}
