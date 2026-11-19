import { EDITOR_EVENT_NAMES } from '@/engine/editor/extensions/events/editor-events';
import type { EventListenerContribution } from '@/engine/editor/extensions/events/event-listener-contribution';
import { requireFunction, requireOneOf } from '../../runtime/values';
import type { ExtensionApiContext } from './extension-api-context';
export function createEventsApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    return {
        names: () => EDITOR_EVENT_NAMES.slice(),
        on: (name: unknown, handler: unknown) => {
            const member = 'helix.editor.events.on';
            const event = requireOneOf(name, EDITOR_EVENT_NAMES, member, 'o evento');
            const listener = requireFunction<(payload: unknown) => void>(handler, member);
            const owner = host.current;
            const contribution: EventListenerContribution = {
                id: extensions.nextEventListenerId(event),
                event,
                notify: (payload) => {
                    context.run(owner, `evento "${event}"`, () => listener(payload));
                },
            };
            return context.own(extensions.eventListeners.register(contribution, context.ownerAssetId()));
        },
    };
}
