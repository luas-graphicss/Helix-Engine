import type { Command } from '@/engine/editor/history/command';
export class CompositeCommand implements Command {
    constructor(readonly label: string, private readonly apply: () => void, private readonly revert: () => void) { }
    execute(): void {
        this.apply();
    }
    undo(): void {
        this.revert();
    }
}
