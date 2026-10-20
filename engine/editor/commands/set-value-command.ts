import type { Command } from '@/engine/editor/history/command';
export class SetValueCommand<T> implements Command {
    constructor(readonly label: string, private readonly apply: (value: T) => void, private readonly before: T, private after: T, readonly mergeKey?: string) { }
    execute(): void {
        this.apply(this.after);
    }
    undo(): void {
        this.apply(this.before);
    }
    merge(next: Command): boolean {
        if (!(next instanceof SetValueCommand))
            return false;
        this.after = next.after as T;
        return true;
    }
}
export class CompositeCommand implements Command {
    constructor(readonly label: string, private readonly commands: Command[]) { }
    execute(): void {
        for (const command of this.commands)
            command.execute();
    }
    undo(): void {
        for (let i = this.commands.length - 1; i >= 0; i--)
            this.commands[i].undo();
    }
}
