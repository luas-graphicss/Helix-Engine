import type { CommandActivity } from '@/engine/editor/history/command';
import type { SessionTopic } from '@/engine/editor/session/session-topics';
import { isActionEntry, type ActionActivityEntry, type ActivityEntry, type ReplayActivityEntry, type ReplayKind } from './activity-entry';
const ENTRY_LIMIT = 500;
type Listener = () => void;
export interface ActionDraft {
    readonly kind: CommandActivity;
    readonly label: string;
    readonly scope: SessionTopic;
}
export interface ReplayDraft {
    readonly kind: ReplayKind;
    readonly label: string;
    readonly scope: SessionTopic;
    readonly actionId: number | undefined;
}
export class ActivityLog {
    private entries: readonly ActivityEntry[] = [];
    private nextId = 1;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): readonly ActivityEntry[] => this.entries;
    recordAction({ kind, label, scope }: ActionDraft): number {
        const action: ActionActivityEntry = { id: this.nextId++, kind, label, scope, occurredAt: Date.now(), undone: false };
        const entries = this.recentEntries();
        entries.push(action);
        this.publish(entries);
        return action.id;
    }
    recordReplay({ kind, label, scope, actionId }: ReplayDraft): void {
        const replay: ReplayActivityEntry = { id: this.nextId++, kind, label, scope, occurredAt: Date.now() };
        const undone = kind === 'undo';
        const entries = this.recentEntries().map((entry) => (entry.id === actionId && isActionEntry(entry) ? { ...entry, undone } : entry));
        entries.push(replay);
        this.publish(entries);
    }
    clear(): void {
        if (this.entries.length === 0)
            return;
        this.publish([]);
    }
    private recentEntries(): ActivityEntry[] {
        return this.entries.slice(-(ENTRY_LIMIT - 1));
    }
    private publish(entries: readonly ActivityEntry[]): void {
        this.entries = entries;
        for (const listener of this.listeners)
            listener();
    }
}
