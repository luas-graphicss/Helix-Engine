import { normalizeEntryKey } from '../settings/entry-key';
import { findLocale, type LocalizationSettings, type StringEntry } from '../settings/localization-settings';
import { hasEntry, withEntry, withEntryValue, withRenamedEntry, withoutEntry } from './entry-edits';
function withStrings(settings: LocalizationSettings, strings: StringEntry[]): LocalizationSettings {
    return strings === settings.strings ? settings : { ...settings, strings };
}
export function addString(settings: LocalizationSettings, name: string): LocalizationSettings {
    const key = normalizeEntryKey(name);
    if (key === null || hasEntry(settings.strings, key))
        return settings;
    return { ...settings, strings: [...settings.strings, { key, note: '', values: {} }] };
}
export function removeString(settings: LocalizationSettings, key: string): LocalizationSettings {
    return withStrings(settings, withoutEntry(settings.strings, key));
}
export function renameString(settings: LocalizationSettings, key: string, name: string): LocalizationSettings {
    return withStrings(settings, withRenamedEntry(settings.strings, key, name));
}
export function setStringNote(settings: LocalizationSettings, key: string, note: string): LocalizationSettings {
    return withStrings(settings, withEntry(settings.strings, key, (entry) => (entry.note === note ? entry : { ...entry, note })));
}
export function setTranslation(settings: LocalizationSettings, key: string, locale: string, text: string): LocalizationSettings {
    return findLocale(settings, locale) ? withStrings(settings, withEntryValue(settings.strings, key, locale, text)) : settings;
}
