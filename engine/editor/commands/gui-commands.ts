import type { GuiDocument } from '@/engine/gui/document/gui-document';
import type { Command } from '@/engine/editor/history/command';
export interface GuiDocumentHost {
    restoreDocument(document: GuiDocument, sessionKey: number): void;
}
export class SetGuiDocumentCommand implements Command {
    readonly scope = 'assets' as const;
    readonly image = false;
    constructor(private readonly host: GuiDocumentHost, readonly label: string, private readonly before: GuiDocument, private after: GuiDocument, private readonly sessionKey: number, readonly mergeKey?: string) { }
    execute(): void {
        this.host.restoreDocument(this.after, this.sessionKey);
    }
    undo(): void {
        this.host.restoreDocument(this.before, this.sessionKey);
    }
    merge(next: Command): boolean {
        if (!(next instanceof SetGuiDocumentCommand) || next.host !== this.host || next.sessionKey !== this.sessionKey)
            return false;
        this.after = next.after;
        return true;
    }
}
