export const DOCS_LOCALES = ['pt-br'] as const;
export type DocsLocale = (typeof DOCS_LOCALES)[number];
export const DEFAULT_DOCS_LOCALE: DocsLocale = 'pt-br';
export const DOCS_LOCALE_LABEL: Record<DocsLocale, string> = {
    'pt-br': 'Português (Brasil)',
};
export const DOCS_LOCALE_TAG: Record<DocsLocale, string> = {
    'pt-br': 'PT-BR',
};
export function isDocsLocale(value: string): value is DocsLocale {
    return (DOCS_LOCALES as readonly string[]).includes(value);
}
