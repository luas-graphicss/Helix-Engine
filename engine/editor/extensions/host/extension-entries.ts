import type { EditorExtensionEntry } from '@/engine/scripting/scripting-settings';
export function sanitizeExtensionEntries(value: unknown): EditorExtensionEntry[] {
    if (!Array.isArray(value))
        return [];
    const seen = new Set<string>();
    const entries: EditorExtensionEntry[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object')
            continue;
        const { assetId, enabled } = item as Partial<EditorExtensionEntry>;
        if (typeof assetId !== 'string' || assetId.length === 0 || seen.has(assetId))
            continue;
        seen.add(assetId);
        entries.push({ assetId, enabled: enabled !== false });
    }
    return entries;
}
export function hasExtension(entries: readonly EditorExtensionEntry[], assetId: string): boolean {
    return entries.some((entry) => entry.assetId === assetId);
}
export function withExtension(entries: readonly EditorExtensionEntry[], assetId: string): EditorExtensionEntry[] {
    return hasExtension(entries, assetId) ? entries.slice() : [...entries, { assetId, enabled: true }];
}
export function withoutExtension(entries: readonly EditorExtensionEntry[], assetId: string): EditorExtensionEntry[] {
    return entries.filter((entry) => entry.assetId !== assetId);
}
export function withExtensionEnabled(entries: readonly EditorExtensionEntry[], assetId: string, enabled: boolean): EditorExtensionEntry[] {
    return entries.map((entry) => (entry.assetId === assetId ? { ...entry, enabled } : entry));
}
