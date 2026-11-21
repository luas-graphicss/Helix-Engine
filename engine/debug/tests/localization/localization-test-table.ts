import { addLocale } from '@/engine/localization/edits/locale-edits';
import { addString, setTranslation } from '@/engine/localization/edits/string-edits';
import { createLocalizationSettings, type LocalizationSettings } from '@/engine/localization/settings/localization-settings';
export type TranslationsByKey = Readonly<Record<string, Readonly<Record<string, string>>>>;
export function buildStringTable(locales: readonly string[], texts: TranslationsByKey): LocalizationSettings {
    let settings = locales.reduce(addLocale, createLocalizationSettings());
    for (const [key, values] of Object.entries(texts)) {
        settings = addString(settings, key);
        for (const [locale, text] of Object.entries(values))
            settings = setTranslation(settings, key, locale, text);
    }
    return settings;
}
