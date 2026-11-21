import { normalizeEntryKey } from '../settings/entry-key';
import type { LocalizedEntry } from '../settings/localization-settings';
export function hasEntry(entries: readonly LocalizedEntry[], key: string): boolean {
    return entries.some((entry) => entry.key === key);
}
export function withEntry<TEntry extends LocalizedEntry>(entries: TEntry[], key: string, change: (entry: TEntry) => TEntry): TEntry[] {
    const index = entries.findIndex((entry) => entry.key === key);
    if (index < 0)
        return entries;
    const changed = change(entries[index]);
    if (changed === entries[index])
        return entries;
    const next = entries.slice();
    next[index] = changed;
    return next;
}
export function withoutEntry<TEntry extends LocalizedEntry>(entries: TEntry[], key: string): TEntry[] {
    return hasEntry(entries, key) ? entries.filter((entry) => entry.key !== key) : entries;
}
export function withRenamedEntry<TEntry extends LocalizedEntry>(entries: TEntry[], key: string, name: string): TEntry[] {
    const nextKey = normalizeEntryKey(name);
    if (nextKey === null || nextKey === key || hasEntry(entries, nextKey))
        return entries;
    return withEntry(entries, key, (entry) => ({ ...entry, key: nextKey }));
}
export function withEntryValue<TEntry extends LocalizedEntry>(entries: TEntry[], key: string, locale: string, value: string): TEntry[] {
    return withEntry(entries, key, (entry) => {
        if ((entry.values[locale] ?? '') === value)
            return entry;
        const values = { ...entry.values };
        if (value.length > 0)
            values[locale] = value;
        else
            delete values[locale];
        return { ...entry, values };
    });
}
export function withoutLocaleValues<TEntry extends LocalizedEntry>(entries: TEntry[], locale: string): TEntry[] {
    return entries.map((entry) => {
        if (!Object.hasOwn(entry.values, locale))
            return entry;
        const values = { ...entry.values };
        delete values[locale];
        return { ...entry, values };
    });
}
