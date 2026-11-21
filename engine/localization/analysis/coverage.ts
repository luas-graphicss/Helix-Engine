import { hasLocalizedValue, type LocalizationSettings, type LocalizedEntry } from '../settings/localization-settings';
const COMPLETE_PERCENT = 100;
export interface LocaleCoverage {
    readonly translated: number;
    readonly total: number;
}
function countValues(entries: readonly LocalizedEntry[], locale: string): number {
    let count = 0;
    for (const entry of entries) {
        if (hasLocalizedValue(entry, locale))
            count++;
    }
    return count;
}
export function localeCoverage(settings: LocalizationSettings, locale: string): LocaleCoverage {
    return {
        translated: countValues(settings.strings, locale) + countValues(settings.assets, locale),
        total: settings.strings.length + settings.assets.length,
    };
}
export function projectCoverage(settings: LocalizationSettings): LocaleCoverage {
    let translated = 0;
    for (const { tag } of settings.locales)
        translated += localeCoverage(settings, tag).translated;
    return { translated, total: (settings.strings.length + settings.assets.length) * settings.locales.length };
}
export function coveragePercent({ translated, total }: LocaleCoverage): number {
    return total === 0 ? COMPLETE_PERCENT : Math.floor((translated / total) * COMPLETE_PERCENT);
}
