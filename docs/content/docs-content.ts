import 'server-only';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import type { DocsLocale } from '../docs-locale';
import { docsArticlePath, docsCategoryPath, type DocsSectionId } from '../docs-routes';
import { categoriesOf, type DocsCategory } from '../navigation/docs-categories';
import { DOCS_SECTIONS, docsSection, type DocsSection } from '../navigation/docs-sections';
import { parseMarkdownDocument, type ArticleFrontmatter } from './frontmatter';
import { extractOutline, plainBodyText, searchableText, type OutlineEntry } from './markdown-outline';
export interface ArticleSummary extends ArticleFrontmatter {
    readonly slug: string;
    readonly section: DocsSectionId;
    readonly category: string;
    readonly path: string;
}
export interface CategoryTree {
    readonly category: DocsCategory;
    readonly path: string;
    readonly articles: readonly ArticleSummary[];
}
export interface SectionTree {
    readonly section: DocsSection;
    readonly categories: readonly CategoryTree[];
}
export interface Article extends ArticleSummary {
    readonly body: string;
    readonly outline: readonly OutlineEntry[];
    readonly previous: ArticleSummary | null;
    readonly next: ArticleSummary | null;
}
export interface SearchRecord {
    readonly title: string;
    readonly description: string;
    readonly path: string;
    readonly section: DocsSectionId;
    readonly sectionLabel: string;
    readonly categoryLabel: string;
    readonly headings: readonly {
        readonly id: string;
        readonly text: string;
    }[];
    readonly excerpt: string;
    readonly text: string;
}
const CONTENT_ROOT = path.join(process.cwd(), 'docs', 'content');
function articleFile(locale: DocsLocale, section: DocsSection, category: string, slug: string): string {
    return path.join(CONTENT_ROOT, locale, section.folder, category, `${slug}.md`);
}
async function listMarkdownFiles(directory: string): Promise<string[]> {
    try {
        const entries = await readdir(directory, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
            .map((entry) => entry.name)
            .sort();
    }
    catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT')
            return [];
        throw cause;
    }
}
async function readArticleSource(file: string): Promise<{
    frontmatter: ArticleFrontmatter;
    body: string;
} | null> {
    try {
        return parseMarkdownDocument(await readFile(file, 'utf8'), path.relative(process.cwd(), file));
    }
    catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT')
            return null;
        throw cause;
    }
}
const loadCategoryTree = cache(async (locale: DocsLocale, category: DocsCategory): Promise<CategoryTree> => {
    const section = docsSection(category.section);
    const directory = path.join(CONTENT_ROOT, locale, section.folder, category.id);
    const files = await listMarkdownFiles(directory);
    const summaries = await Promise.all(files.map(async (file): Promise<ArticleSummary> => {
        const slug = file.slice(0, -'.md'.length);
        const parsed = await readArticleSource(path.join(directory, file));
        if (!parsed)
            throw new Error(`Artigo desapareceu durante a leitura: ${file}`);
        return { ...parsed.frontmatter, slug, section: section.id, category: category.id, path: docsArticlePath(section.id, category.id, slug, locale) };
    }));
    summaries.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
    return { category, path: docsCategoryPath(section.id, category.id, locale), articles: summaries };
});
export const loadSectionTree = cache(async (locale: DocsLocale, sectionId: DocsSectionId): Promise<SectionTree> => {
    const section = docsSection(sectionId);
    const categories = await Promise.all(categoriesOf(sectionId).map((category) => loadCategoryTree(locale, category)));
    return { section, categories: categories.filter((tree) => tree.articles.length > 0) };
});
export async function loadAllSections(locale: DocsLocale): Promise<SectionTree[]> {
    return Promise.all(DOCS_SECTIONS.map((section) => loadSectionTree(locale, section.id)));
}
export async function loadCategory(locale: DocsLocale, sectionId: DocsSectionId, categoryId: string): Promise<CategoryTree | null> {
    const tree = await loadSectionTree(locale, sectionId);
    return tree.categories.find((entry) => entry.category.id === categoryId) ?? null;
}
export async function loadArticle(locale: DocsLocale, sectionId: DocsSectionId, categoryId: string, slug: string): Promise<Article | null> {
    const section = docsSection(sectionId);
    const parsed = await readArticleSource(articleFile(locale, section, categoryId, slug));
    if (!parsed)
        return null;
    const tree = await loadSectionTree(locale, sectionId);
    const readingOrder = tree.categories.flatMap((category) => category.articles);
    const index = readingOrder.findIndex((entry) => entry.category === categoryId && entry.slug === slug);
    if (index === -1)
        return null;
    return {
        ...readingOrder[index],
        body: parsed.body,
        outline: extractOutline(parsed.body),
        previous: readingOrder[index - 1] ?? null,
        next: readingOrder[index + 1] ?? null,
    };
}
export async function listArticleRoutes(locale: DocsLocale): Promise<{
    section: DocsSectionId;
    category: string;
    slug: string;
}[]> {
    const sections = await loadAllSections(locale);
    return sections.flatMap((tree) => tree.categories.flatMap((category) => category.articles.map((article) => ({ section: tree.section.id, category: category.category.id, slug: article.slug }))));
}
export async function buildSearchIndex(locale: DocsLocale): Promise<SearchRecord[]> {
    const sections = await loadAllSections(locale);
    const records: SearchRecord[] = [];
    for (const tree of sections) {
        for (const category of tree.categories) {
            for (const summary of category.articles) {
                const parsed = await readArticleSource(articleFile(locale, tree.section, category.category.id, summary.slug));
                if (!parsed)
                    continue;
                records.push({
                    title: summary.title,
                    description: summary.description,
                    path: summary.path,
                    section: tree.section.id,
                    sectionLabel: tree.section.label,
                    categoryLabel: category.category.title,
                    headings: extractOutline(parsed.body).map(({ id, text }) => ({ id, text })),
                    excerpt: plainBodyText(parsed.body),
                    text: searchableText(parsed.body),
                });
            }
        }
    }
    return records;
}
