import { canonicalLocaleTag } from '../locale/locale-tag';
import { normalizeEntryKey } from './entry-key';
import { DEFAULT_LOCALIZED_ASSET_KIND, DEFAULT_SOURCE_LOCALE, createLocaleEntry, isLocalizedAssetKind, type LocaleEntry, type LocalizationSettings, type LocalizedAssetEntry, type LocalizedEntry, type StringEntry } from './localization-settings';
type LooseRecord = Record<string, unknown>;
function isRecord(value: unknown): value is LooseRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function recordsOf(value: unknown): LooseRecord[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}
function readLocales(value: unknown): LocaleEntry[] {
    const locales = new Map<string, LocaleEntry>();
    for (const item of recordsOf(value)) {
        const tag = canonicalLocaleTag(item.tag);
        if (tag !== null && !locales.has(tag))
            locales.set(tag, { tag, fallback: canonicalLocaleTag(item.fallback), enabled: item.enabled !== false });
    }
    return [...locales.values()];
}
function repairLocales(locales: readonly LocaleEntry[], sourceLocale: string): LocaleEntry[] {
    const tags = new Set(locales.map((locale) => locale.tag));
    return locales.map(({ tag, fallback, enabled }) => ({
        tag,
        fallback: fallback !== null && fallback !== tag && tags.has(fallback) ? fallback : null,
        enabled: enabled || tag === sourceLocale,
    }));
}
function readValues(value: unknown, tags: ReadonlySet<string>): Record<string, string> {
    const values: Record<string, string> = {};
    if (!isRecord(value))
        return values;
    for (const [locale, text] of Object.entries(value)) {
        const tag = canonicalLocaleTag(locale);
        if (tag !== null && tags.has(tag) && typeof text === 'string' && text.length > 0)
            values[tag] = text;
    }
    return values;
}
function readEntries<TEntry extends LocalizedEntry>(value: unknown, read: (item: LooseRecord, key: string) => TEntry): TEntry[] {
    const entries = new Map<string, TEntry>();
    for (const item of recordsOf(value)) {
        const key = normalizeEntryKey(item.key);
        if (key !== null && !entries.has(key))
            entries.set(key, read(item, key));
    }
    return [...entries.values()];
}
export function normalizeLocalizationSettings(value: unknown): LocalizationSettings {
    const source = isRecord(value) ? value : {};
    const declared = readLocales(source.locales);
    const sourceLocale = canonicalLocaleTag(source.sourceLocale) ?? declared[0]?.tag ?? DEFAULT_SOURCE_LOCALE;
    if (!declared.some((locale) => locale.tag === sourceLocale))
        declared.unshift(createLocaleEntry(sourceLocale));
    const locales = repairLocales(declared, sourceLocale);
    const tags = new Set(locales.map((locale) => locale.tag));
    const startupLocale = canonicalLocaleTag(source.startupLocale);
    return {
        sourceLocale,
        startupLocale: locales.some((locale) => locale.tag === startupLocale && locale.enabled) ? startupLocale : null,
        locales,
        strings: readEntries<StringEntry>(source.strings, (item, key) => ({ key, note: typeof item.note === 'string' ? item.note : '', values: readValues(item.values, tags) })),
        assets: readEntries<LocalizedAssetEntry>(source.assets, (item, key) => ({ key, kind: isLocalizedAssetKind(item.kind) ? item.kind : DEFAULT_LOCALIZED_ASSET_KIND, values: readValues(item.values, tags) })),
    };
}
