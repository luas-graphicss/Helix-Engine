import type { Command } from './command';
const MERGE_WINDOW_MS = 1200;
export class History {
    private readonly undoStack: Command[] = [];
    private readonly redoStack: Command[] = [];
    private lastPushTime = -Infinity;
    constructor(private readonly onChange: () => void, private readonly limit = 200) { }
    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }
    get undoLabel(): string | null {
        return this.undoStack.at(-1)?.label ?? null;
    }
    get redoLabel(): string | null {
        return this.redoStack.at(-1)?.label ?? null;
    }
    execute(command: Command): void {
        command.execute();
        this.redoStack.length = 0;
        const now = performance.now();
        const top = this.undoStack.at(-1);
        const canMerge = top !== undefined &&
            command.mergeKey !== undefined &&
            top.mergeKey === command.mergeKey &&
            now - this.lastPushTime < MERGE_WINDOW_MS &&
            top.merge?.(command) === true;
        if (!canMerge) {
            this.undoStack.push(command);
            if (this.undoStack.length > this.limit)
                this.undoStack.shift();
        }
        this.lastPushTime = now;
        this.onChange();
    }
    undo(): void {
        const command = this.undoStack.pop();
        if (!command)
            return;
        command.undo();
        this.redoStack.push(command);
        this.lastPushTime = -Infinity;
        this.onChange();
    }
    redo(): void {
        const command = this.redoStack.pop();
        if (!command)
            return;
        command.execute();
        this.undoStack.push(command);
        this.lastPushTime = -Infinity;
        this.onChange();
    }
    endMerge(): void {
        this.lastPushTime = -Infinity;
    }
    clear(): void {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
        this.lastPushTime = -Infinity;
        this.onChange();
    }
}
