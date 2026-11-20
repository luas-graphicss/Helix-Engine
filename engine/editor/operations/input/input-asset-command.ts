import type { Command } from '@/engine/editor/history/command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { InputAsset } from '@/engine/input/actions/input-asset';
class InputAssetCommand implements Command {
    readonly image = false;
    constructor(readonly label: string, private readonly target: InputAsset, private readonly before: InputAsset, private after: InputAsset, readonly mergeKey?: string) { }
    execute(): void {
        Object.assign(this.target, this.after);
    }
    undo(): void {
        Object.assign(this.target, this.before);
    }
    merge(next: Command): boolean {
        if (!(next instanceof InputAssetCommand))
            return false;
        this.after = next.after;
        return true;
    }
}
export function applyInputEdit(session: EditorSession, label: string, edit: (asset: InputAsset) => InputAsset, mergeKey?: string): void {
    const { input } = session.scene;
    const next = edit(input);
    if (next !== input)
        session.history.execute(new InputAssetCommand(label, input, { ...input }, next, mergeKey));
}
