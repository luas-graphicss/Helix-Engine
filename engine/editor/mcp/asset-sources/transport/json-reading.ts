import { isFiniteNumber, isRecord, isText, type JsonRecord } from '@/engine/mcp/protocol/json-shape';
const SECURE_PROTOCOL = 'https:';
function valueAt(parent: JsonRecord, key: string): unknown {
    return Object.hasOwn(parent, key) ? parent[key] : undefined;
}
export function recordAt(parent: JsonRecord, key: string): JsonRecord | null {
    const value = valueAt(parent, key);
    return isRecord(value) ? value : null;
}
export function recordAtPath(parent: JsonRecord, ...keys: readonly string[]): JsonRecord | null {
    let current: JsonRecord | null = parent;
    for (const key of keys) {
        if (!current)
            return null;
        current = recordAt(current, key);
    }
    return current;
}
export function textAt(parent: JsonRecord, key: string): string {
    const value = valueAt(parent, key);
    return isText(value) ? value.trim() : '';
}
export function numberAt(parent: JsonRecord, key: string): number | null {
    const value = valueAt(parent, key);
    return isFiniteNumber(value) ? value : null;
}
export function listAt(parent: JsonRecord, key: string): readonly unknown[] {
    const value = valueAt(parent, key);
    return Array.isArray(value) ? value : [];
}
export function recordsAt(parent: JsonRecord, key: string): JsonRecord[] {
    return listAt(parent, key).filter(isRecord);
}
export function textsAt(parent: JsonRecord, key: string): string[] {
    return listAt(parent, key).filter(isText);
}
export function parseHttpsUrl(address: string): URL | null {
    if (!URL.canParse(address))
        return null;
    const url = new URL(address);
    return url.protocol === SECURE_PROTOCOL && !url.username && !url.password ? url : null;
}
export function httpsUrlAt(parent: JsonRecord, key: string): URL | null {
    return parseHttpsUrl(textAt(parent, key));
}
