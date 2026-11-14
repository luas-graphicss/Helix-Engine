import type { Command } from '@/engine/editor/history/command';
import type { HistoryEvent } from '@/engine/editor/history/history';
import type { ActivityLog } from './activity-log';
export function createHistoryActivityRecorder(log: ActivityLog): (event: HistoryEvent) => void {
    const actionIds = new WeakMap<Command, number>();
    return ({ kind, command }) => {
        const { label } = command;
        const scope = command.scope ?? 'scene';
        if (kind === 'execute') {
            actionIds.set(command, log.recordAction({ kind: command.activity ?? 'edit', label, scope }));
            return;
        }
        log.recordReplay({ kind, label, scope, actionId: actionIds.get(command) });
    };
}
