import { pickLocalizedValue, resolveFallbackChain } from '../fallback/fallback-chain';
import { hasLocalizedValue, type LocalizationSettings } from '../settings/localization-settings';
const COMPLETE_PERCENT = 100;
export interface LocaleCoverage {
    readonly translated: number;
    readonly total: number;
}
function countWhere<TEntry>(entries: readonly TEntry[], isCovered: (entry: TEntry) => boolean): number {
    let count = 0;
    for (const entry of entries) {
        if (isCovered(entry))
            count++;
    }
    return count;
}
export function localeCoverage(settings: LocalizationSettings, locale: string): LocaleCoverage {
    const chain = resolveFallbackChain(settings, locale);
    const strings = countWhere(settings.strings, (entry) => hasLocalizedValue(entry, locale));
    const assets = countWhere(settings.assets, (entry) => pickLocalizedValue(entry.values, chain) !== null);
    return { translated: strings + assets, total: settings.strings.length + settings.assets.length };
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
