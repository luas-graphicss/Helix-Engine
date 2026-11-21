export type PluralCategory = Intl.LDMLPluralRule;
const rulesByKey = new Map<string, Intl.PluralRules>();
function pluralRules(locale: string, ordinal: boolean): Intl.PluralRules {
    const type = ordinal ? 'ordinal' : 'cardinal';
    const cacheKey = `${locale}|${type}`;
    const known = rulesByKey.get(cacheKey);
    if (known)
        return known;
    const rules = new Intl.PluralRules(locale, { type });
    rulesByKey.set(cacheKey, rules);
    return rules;
}
export function pluralCategory(locale: string, count: number, ordinal = false): PluralCategory {
    return pluralRules(locale, ordinal).select(count);
}
export function pluralCategories(locale: string, ordinal = false): PluralCategory[] {
    return pluralRules(locale, ordinal).resolvedOptions().pluralCategories;
}
