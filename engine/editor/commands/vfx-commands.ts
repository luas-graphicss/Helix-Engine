import type { VfxDocument } from '@/engine/vfx/document/vfx-document';
import type { Command } from '@/engine/editor/history/command';
export interface VfxDocumentHost {
    restoreDocument(document: VfxDocument, sessionKey: number): void;
}
export class SetVfxDocumentCommand implements Command {
    readonly scope = 'assets' as const;
    readonly image = false;
    constructor(private readonly host: VfxDocumentHost, readonly label: string, private readonly before: VfxDocument, private after: VfxDocument, private readonly sessionKey: number, readonly mergeKey?: string) { }
    execute(): void {
        this.host.restoreDocument(this.after, this.sessionKey);
    }
    undo(): void {
        this.host.restoreDocument(this.before, this.sessionKey);
    }
    merge(next: Command): boolean {
        if (!(next instanceof SetVfxDocumentCommand) || next.host !== this.host || next.sessionKey !== this.sessionKey)
            return false;
        this.after = next.after;
        return true;
    }
}
