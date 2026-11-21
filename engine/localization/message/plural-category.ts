export type PluralCategory = Intl.LDMLPluralRule;
const LARGEST_SAMPLED_COUNT = 200;
const FALLBACK_CATEGORY: PluralCategory = 'other';
const rulesByKey = new Map<string, Intl.PluralRules>();
const wholeNumberCategoriesByKey = new Map<string, PluralCategory[]>();
function rulesKey(locale: string, ordinal: boolean): string {
    return `${locale}|${ordinal ? 'ordinal' : 'cardinal'}`;
}
function pluralRules(locale: string, ordinal: boolean): Intl.PluralRules {
    const cacheKey = rulesKey(locale, ordinal);
    const known = rulesByKey.get(cacheKey);
    if (known)
        return known;
    const rules = new Intl.PluralRules(locale, { type: ordinal ? 'ordinal' : 'cardinal' });
    rulesByKey.set(cacheKey, rules);
    return rules;
}
export function pluralCategory(locale: string, count: number, ordinal = false): PluralCategory {
    return pluralRules(locale, ordinal).select(count);
}
export function wholeNumberPluralCategories(locale: string, ordinal = false): PluralCategory[] {
    const cacheKey = rulesKey(locale, ordinal);
    const known = wholeNumberCategoriesByKey.get(cacheKey);
    if (known)
        return known;
    const rules = pluralRules(locale, ordinal);
    const reached = new Set<PluralCategory>([FALLBACK_CATEGORY]);
    for (let count = 0; count <= LARGEST_SAMPLED_COUNT; count++)
        reached.add(rules.select(count));
    const categories = rules.resolvedOptions().pluralCategories.filter((category) => reached.has(category));
    wholeNumberCategoriesByKey.set(cacheKey, categories);
    return categories;
}
