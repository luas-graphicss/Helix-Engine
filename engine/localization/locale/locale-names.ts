const EDITOR_LOCALE = 'pt-BR';
const namesByLocale = new Map<string, Intl.DisplayNames>();
function languageNames(displayLocale: string): Intl.DisplayNames {
    const known = namesByLocale.get(displayLocale);
    if (known)
        return known;
    const names = new Intl.DisplayNames([displayLocale], { type: 'language', languageDisplay: 'standard' });
    namesByLocale.set(displayLocale, names);
    return names;
}
function capitalize(text: string, locale: string): string {
    const [first = '', ...rest] = text;
    return first.toLocaleUpperCase(locale) + rest.join('');
}
export function localeDisplayName(tag: string, displayLocale = EDITOR_LOCALE): string {
    return capitalize(languageNames(displayLocale).of(tag) ?? tag, displayLocale);
}
export function localeNativeName(tag: string): string {
    return localeDisplayName(tag, tag);
}
