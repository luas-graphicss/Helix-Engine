import { parentLocaleTags } from '../locale/locale-tag';
import type { LocalizationSettings } from '../settings/localization-settings';
export interface LocalizedValue {
    readonly locale: string;
    readonly value: string;
}
export function resolveFallbackChain(settings: LocalizationSettings, tag: string): string[] {
    const known = new Map(settings.locales.map((locale) => [locale.tag, locale]));
    const chain: string[] = [];
    const visit = (candidate: string): void => {
        const locale = known.get(candidate);
        if (!locale || chain.includes(candidate))
            return;
        chain.push(candidate);
        if (locale.fallback !== null) {
            visit(locale.fallback);
            return;
        }
        for (const parent of parentLocaleTags(candidate))
            visit(parent);
    };
    visit(tag);
    visit(settings.sourceLocale);
    return chain;
}
export function pickLocalizedValue(values: Readonly<Record<string, string>>, chain: readonly string[]): LocalizedValue | null {
    for (const locale of chain) {
        if (Object.hasOwn(values, locale))
            return { locale, value: values[locale] };
    }
    return null;
}
