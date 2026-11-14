import type { SessionTopic } from '@/engine/editor/session/session-topics';
export type CommandActivity = 'insert' | 'import' | 'remove' | 'edit';
export interface Command {
    readonly label: string;
    readonly mergeKey?: string;
    readonly scope?: SessionTopic;
    readonly image?: boolean;
    readonly activity?: CommandActivity;
    execute(): void;
    undo(): void;
    merge?(next: Command): boolean;
}
