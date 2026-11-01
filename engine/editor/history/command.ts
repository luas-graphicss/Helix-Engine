import type { SessionTopic } from '@/engine/editor/session/session-topics';
export interface Command {
    readonly label: string;
    readonly mergeKey?: string;
    readonly scope?: SessionTopic;
    readonly image?: boolean;
    execute(): void;
    undo(): void;
    merge?(next: Command): boolean;
}
