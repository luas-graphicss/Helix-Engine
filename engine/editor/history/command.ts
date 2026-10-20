export interface Command {
    readonly label: string;
    readonly mergeKey?: string;
    execute(): void;
    undo(): void;
    merge?(next: Command): boolean;
}
