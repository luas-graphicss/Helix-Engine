import type { CommandActivity } from '@/engine/editor/history/command';
import type { HistoryEventKind } from '@/engine/editor/history/history';
import type { SessionTopic } from '@/engine/editor/session/session-topics';
export type ReplayKind = Exclude<HistoryEventKind, 'execute'>;
export type ActivityKind = CommandActivity | ReplayKind;
interface ActivityEntryBase {
    readonly id: number;
    readonly label: string;
    readonly scope: SessionTopic;
    readonly occurredAt: number;
}
export interface ActionActivityEntry extends ActivityEntryBase {
    readonly kind: CommandActivity;
    readonly undone: boolean;
}
export interface ReplayActivityEntry extends ActivityEntryBase {
    readonly kind: ReplayKind;
}
export type ActivityEntry = ActionActivityEntry | ReplayActivityEntry;
export function isActionEntry(entry: ActivityEntry): entry is ActionActivityEntry {
    return entry.kind !== 'undo' && entry.kind !== 'redo';
}
