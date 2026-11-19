import type { ShaderGraphDocument } from '@/engine/shader-graph/document/graph-document';
import type { Command } from '@/engine/editor/history/command';
export interface ShaderGraphHost {
    restoreGraph(graphId: string, graph: ShaderGraphDocument): void;
}
export class SetShaderGraphCommand implements Command {
    readonly scope = 'history' as const;
    readonly image = false;
    constructor(private readonly host: ShaderGraphHost, readonly label: string, private readonly graphId: string, private readonly before: ShaderGraphDocument, private after: ShaderGraphDocument, readonly mergeKey?: string) { }
    execute(): void {
        this.host.restoreGraph(this.graphId, this.after);
    }
    undo(): void {
        this.host.restoreGraph(this.graphId, this.before);
    }
    merge(next: Command): boolean {
        if (!(next instanceof SetShaderGraphCommand) || next.host !== this.host || next.graphId !== this.graphId)
            return false;
        this.after = next.after;
        return true;
    }
}
