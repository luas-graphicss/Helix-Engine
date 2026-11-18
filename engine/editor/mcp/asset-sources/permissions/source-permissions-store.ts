import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import { normalizeApiKey, parseSourcePermissions, permissionOf, serializeSourcePermissions, type SourcePermission, type SourcePermissions } from './source-permissions';
const PREFERENCE_KEY = 'mcp-asset-sources';
const PERSIST_DELAY_MS = 400;
type Listener = () => void;
export class SourcePermissionsStore {
    private permissions = parseSourcePermissions(null);
    private edited = false;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): SourcePermissions => this.permissions;
    async load(): Promise<void> {
        const stored = await readPreference<unknown>(PREFERENCE_KEY);
        if (!this.edited && stored !== null)
            this.publish(parseSourcePermissions(stored));
    }
    setAllowed(sourceId: string, allowed: boolean): void {
        this.patch(sourceId, { allowed });
    }
    setApiKey(sourceId: string, apiKey: string): void {
        this.patch(sourceId, { apiKey: normalizeApiKey(apiKey) });
    }
    private patch(sourceId: string, patch: Partial<SourcePermission>): void {
        if (!this.permissions.has(sourceId))
            return;
        this.edited = true;
        this.publish(new Map(this.permissions).set(sourceId, { ...permissionOf(this.permissions, sourceId), ...patch }));
        if (this.persistTimer)
            clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            void writePreference(PREFERENCE_KEY, serializeSourcePermissions(this.permissions));
        }, PERSIST_DELAY_MS);
    }
    private publish(permissions: SourcePermissions): void {
        this.permissions = permissions;
        for (const listener of this.listeners)
            listener();
    }
}
