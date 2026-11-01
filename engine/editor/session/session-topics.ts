export type SessionTopic = 'scene' | 'selection' | 'tool' | 'view' | 'workspace' | 'history' | 'project' | 'log' | 'resources' | 'assets' | 'playtest';
export const SESSION_TOPICS: readonly SessionTopic[] = [
    'scene',
    'selection',
    'tool',
    'view',
    'workspace',
    'history',
    'project',
    'log',
    'resources',
    'assets',
    'playtest',
];
export const IMAGE_TOPICS: ReadonlySet<SessionTopic> = new Set<SessionTopic>([
    'scene',
    'selection',
    'tool',
    'view',
    'workspace',
    'resources',
    'playtest',
]);
export interface NotifyOptions {
    image?: boolean;
}
