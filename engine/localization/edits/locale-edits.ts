import { canonicalLocaleTag } from '../locale/locale-tag';
import { createLocaleEntry, findLocale, type LocaleEntry, type LocalizationSettings } from '../settings/localization-settings';
import { withoutLocaleValues } from './entry-edits';
function withLocale(settings: LocalizationSettings, tag: string, patch: Partial<Omit<LocaleEntry, 'tag'>>): LocalizationSettings {
    return { ...settings, locales: settings.locales.map((locale) => (locale.tag === tag ? { ...locale, ...patch } : locale)) };
}
export function addLocale(settings: LocalizationSettings, name: string): LocalizationSettings {
    const tag = canonicalLocaleTag(name);
    if (tag === null || findLocale(settings, tag))
        return settings;
    return { ...settings, locales: [...settings.locales, createLocaleEntry(tag)] };
}
export function removeLocale(settings: LocalizationSettings, tag: string): LocalizationSettings {
    if (tag === settings.sourceLocale || !findLocale(settings, tag))
        return settings;
    return {
        sourceLocale: settings.sourceLocale,
        startupLocale: settings.startupLocale === tag ? null : settings.startupLocale,
        locales: settings.locales.filter((locale) => locale.tag !== tag).map((locale) => (locale.fallback === tag ? { ...locale, fallback: null } : locale)),
        strings: withoutLocaleValues(settings.strings, tag),
        assets: withoutLocaleValues(settings.assets, tag),
    };
}
export function setSourceLocale(settings: LocalizationSettings, tag: string): LocalizationSettings {
    if (tag === settings.sourceLocale || !findLocale(settings, tag))
        return settings;
    return { ...withLocale(settings, tag, { enabled: true }), sourceLocale: tag };
}
export function setLocaleFallback(settings: LocalizationSettings, tag: string, fallback: string | null): LocalizationSettings {
    const locale = findLocale(settings, tag);
    if (!locale || locale.fallback === fallback || fallback === tag)
        return settings;
    if (fallback !== null && !findLocale(settings, fallback))
        return settings;
    return withLocale(settings, tag, { fallback });
}
export function setLocaleEnabled(settings: LocalizationSettings, tag: string, enabled: boolean): LocalizationSettings {
    const locale = findLocale(settings, tag);
    if (!locale || locale.enabled === enabled || tag === settings.sourceLocale)
        return settings;
    const next = withLocale(settings, tag, { enabled });
    return !enabled && settings.startupLocale === tag ? { ...next, startupLocale: null } : next;
}
export function setStartupLocale(settings: LocalizationSettings, tag: string | null): LocalizationSettings {
    if (tag === settings.startupLocale)
        return settings;
    if (tag !== null && !findLocale(settings, tag)?.enabled)
        return settings;
    return { ...settings, startupLocale: tag };
}
