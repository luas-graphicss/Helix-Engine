import { negotiateLocale } from '../locale/locale-negotiation';
import { enabledLocaleTags, findLocale, type LocalizationSettings } from '../settings/localization-settings';
export function resolveStartupLocale(settings: LocalizationSettings, preferredLocales: readonly string[]): string {
    const { startupLocale } = settings;
    if (startupLocale !== null && findLocale(settings, startupLocale)?.enabled)
        return startupLocale;
    return negotiateLocale(enabledLocaleTags(settings), preferredLocales) ?? settings.sourceLocale;
}
