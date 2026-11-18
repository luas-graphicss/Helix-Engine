import { isRecord, isText } from '@/engine/mcp/protocol/json-shape';
import type { AssetSource } from '../catalog/asset-source';
import { ASSET_SOURCES } from '../catalog/source-catalog';
export interface SourcePermission {
    readonly allowed: boolean;
    readonly apiKey: string;
}
export type SourcePermissions = ReadonlyMap<string, SourcePermission>;
export type SourceReadiness = 'ready' | 'blocked' | 'missingKey';
const MAX_API_KEY_LENGTH = 256;
const BLOCKED: SourcePermission = { allowed: false, apiKey: '' };
export function normalizeApiKey(apiKey: string): string {
    return apiKey.trim().slice(0, MAX_API_KEY_LENGTH);
}
function parsePermission(value: unknown): SourcePermission {
    if (!isRecord(value))
        return BLOCKED;
    const { allowed, apiKey } = value;
    return { allowed: allowed === true, apiKey: isText(apiKey) ? normalizeApiKey(apiKey) : '' };
}
export function parseSourcePermissions(stored: unknown): SourcePermissions {
    const record = isRecord(stored) ? stored : {};
    return new Map(ASSET_SOURCES.map(({ id }) => [id, Object.hasOwn(record, id) ? parsePermission(record[id]) : BLOCKED]));
}
export function serializeSourcePermissions(permissions: SourcePermissions): Record<string, SourcePermission> {
    return Object.fromEntries(permissions);
}
export function permissionOf(permissions: SourcePermissions, sourceId: string): SourcePermission {
    return permissions.get(sourceId) ?? BLOCKED;
}
export function readinessOf(source: AssetSource, permission: SourcePermission): SourceReadiness {
    if (!permission.allowed)
        return 'blocked';
    return source.credential && !permission.apiKey ? 'missingKey' : 'ready';
}
