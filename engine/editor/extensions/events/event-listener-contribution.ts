import type { Contribution } from '../registry/contribution-registry';
import type { EditorEventName } from './editor-events';
export interface EventListenerContribution extends Contribution {
    readonly event: EditorEventName;
    notify(payload: unknown): void;
}
export function notifyEventListeners(listeners: readonly EventListenerContribution[], event: EditorEventName, payload: unknown): void {
    for (const listener of listeners)
        if (listener.event === event)
            listener.notify(payload);
}
