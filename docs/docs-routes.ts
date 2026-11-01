import { DEFAULT_DOCS_LOCALE, type DocsLocale } from './docs-locale';
export const DOCS_BASE_PATH = '/helix/docs';
export type DocsSectionId = 'manual' | 'tutorial' | 'referencia';
export const PREFIXED_SECTIONS: readonly Exclude<DocsSectionId, 'manual'>[] = ['tutorial', 'referencia'];
export function isPrefixedSection(value: string): value is Exclude<DocsSectionId, 'manual'> {
    return (PREFIXED_SECTIONS as readonly string[]).includes(value);
}
export function docsHomePath(locale: DocsLocale = DEFAULT_DOCS_LOCALE): string {
    return `${DOCS_BASE_PATH}/${locale}`;
}
export function docsSectionPath(section: DocsSectionId, locale: DocsLocale = DEFAULT_DOCS_LOCALE): string {
    return section === 'manual' ? docsHomePath(locale) : `${docsHomePath(locale)}/${section}`;
}
export function docsCategoryPath(section: DocsSectionId, category: string, locale: DocsLocale = DEFAULT_DOCS_LOCALE): string {
    return `${docsSectionPath(section, locale)}/${category}`;
}
export function docsArticlePath(section: DocsSectionId, category: string, article: string, locale: DocsLocale = DEFAULT_DOCS_LOCALE): string {
    return `${docsCategoryPath(section, category, locale)}/${article}`;
}
export function docsSearchPath(locale: DocsLocale = DEFAULT_DOCS_LOCALE): string {
    return `${docsHomePath(locale)}/search`;
}
export function sectionFromPathname(pathname: string, locale: DocsLocale): DocsSectionId {
    const rest = pathname.slice(docsHomePath(locale).length).split('/').filter(Boolean);
    const head = rest[0];
    return head && isPrefixedSection(head) ? head : 'manual';
}
export type DocsRoute = {
    readonly kind: 'section';
    readonly section: DocsSectionId;
} | {
    readonly kind: 'category';
    readonly section: DocsSectionId;
    readonly category: string;
} | {
    readonly kind: 'article';
    readonly section: DocsSectionId;
    readonly category: string;
    readonly article: string;
};
export function resolveDocsRoute(segments: readonly string[]): DocsRoute | null {
    const [head, ...rest] = segments;
    if (!head)
        return { kind: 'section', section: 'manual' };
    const section: DocsSectionId = isPrefixedSection(head) ? head : 'manual';
    const tail = section === 'manual' ? segments : rest;
    if (tail.length === 0)
        return { kind: 'section', section };
    if (tail.length === 1)
        return { kind: 'category', section, category: tail[0] };
    if (tail.length === 2)
        return { kind: 'article', section, category: tail[0], article: tail[1] };
    return null;
}
