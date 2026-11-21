import { canonicalLocaleTag, localeLanguage, parentLocaleTags } from './locale-tag';
function sharesWritingSystem(first: string, second: string): boolean {
    const left = new Intl.Locale(first).maximize();
    const right = new Intl.Locale(second).maximize();
    return left.language === right.language && left.script === right.script;
}
function matchLocale(available: readonly string[], requested: string): string | null {
    if (available.includes(requested))
        return requested;
    const parent = parentLocaleTags(requested).find((tag) => available.includes(tag));
    if (parent)
        return parent;
    const language = localeLanguage(requested);
    return available.find((tag) => sharesWritingSystem(tag, requested)) ?? available.find((tag) => localeLanguage(tag) === language) ?? null;
}
export function negotiateLocale(available: readonly string[], requested: readonly string[]): string | null {
    for (const candidate of requested) {
        const tag = canonicalLocaleTag(candidate);
        const match = tag === null ? null : matchLocale(available, tag);
        if (match !== null)
            return match;
    }
    return null;
}
