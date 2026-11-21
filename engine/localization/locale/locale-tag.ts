const RIGHT_TO_LEFT_SCRIPTS: ReadonlySet<string> = new Set(['Arab', 'Hebr', 'Thaa', 'Syrc', 'Nkoo', 'Adlm', 'Rohg']);
export type TextDirection = 'ltr' | 'rtl';
export function canonicalLocaleTag(value: unknown): string | null {
    if (typeof value !== 'string')
        return null;
    const candidate = value.trim().replaceAll('_', '-');
    if (candidate.length === 0)
        return null;
    try {
        return Intl.getCanonicalLocales(candidate)[0] ?? null;
    }
    catch (cause) {
        if (cause instanceof RangeError)
            return null;
        throw cause;
    }
}
export function isSupportedLocale(tag: string): boolean {
    return Intl.PluralRules.supportedLocalesOf([tag]).length > 0;
}
export function parentLocaleTags(tag: string): string[] {
    const parents: string[] = [];
    for (let end = tag.lastIndexOf('-'); end > 0; end = tag.lastIndexOf('-', end - 1))
        parents.push(tag.slice(0, end));
    return parents;
}
export function localeLanguage(tag: string): string {
    return new Intl.Locale(tag).language;
}
export function localeDirection(tag: string): TextDirection {
    const { script } = new Intl.Locale(tag).maximize();
    return script !== undefined && RIGHT_TO_LEFT_SCRIPTS.has(script) ? 'rtl' : 'ltr';
}
