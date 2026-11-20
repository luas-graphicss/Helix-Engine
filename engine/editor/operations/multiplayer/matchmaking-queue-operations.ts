import type { EditorSession } from '@/engine/editor/session/editor-session';
import { DEFAULT_QUEUE, type QueueConfig } from '@/engine/net/services/matchmaking/matchmaking-types';
import { MAX_QUEUES } from '@/engine/net/settings/multiplayer-settings';
import { editMultiplayer } from './multiplayer-settings-operations';
const NEW_QUEUE_NAME = 'fila';
function uniqueQueueName(queues: readonly QueueConfig[]): string {
    const taken = new Set(queues.map((queue) => queue.name));
    for (let suffix = 1;; suffix++) {
        const candidate = suffix === 1 ? NEW_QUEUE_NAME : `${NEW_QUEUE_NAME}${suffix}`;
        if (!taken.has(candidate))
            return candidate;
    }
}
export function canAddMatchQueue(session: EditorSession): boolean {
    return session.scene.multiplayer.matchmaking.queues.length < MAX_QUEUES;
}
export function addMatchQueue(session: EditorSession): void {
    editMultiplayer(session, 'Adicionar fila de matchmaking', (settings) => {
        const { queues } = settings.matchmaking;
        return { ...settings, matchmaking: { ...settings.matchmaking, queues: [...queues, { ...DEFAULT_QUEUE, name: uniqueQueueName(queues) }] } };
    });
}
export function updateMatchQueue(session: EditorSession, queueName: string, patch: Partial<QueueConfig>): void {
    const keys = Object.keys(patch);
    editMultiplayer(session, 'Fila de matchmaking', (settings) => ({
        ...settings,
        matchmaking: { ...settings.matchmaking, queues: settings.matchmaking.queues.map((queue) => (queue.name === queueName ? { ...queue, ...patch } : queue)) },
    }), keys.length === 1 && keys[0] !== 'name' ? `multiplayer.queue.${queueName}.${keys[0]}` : undefined);
}
export function removeMatchQueue(session: EditorSession, queueName: string): void {
    editMultiplayer(session, 'Excluir fila de matchmaking', (settings) => ({
        ...settings,
        matchmaking: { ...settings.matchmaking, queues: settings.matchmaking.queues.filter((queue) => queue.name !== queueName) },
    }));
}
