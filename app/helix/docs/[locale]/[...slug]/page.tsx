import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsArticle } from '@/docs/components/docs-article';
import { DocsCategoryPage } from '@/docs/components/docs-category-page';
import { ReferenceHome } from '@/docs/components/reference-home';
import { TutorialHome } from '@/docs/components/tutorial-home';
import { listArticleRoutes, loadArticle, loadCategory, loadSectionTree } from '@/docs/content/docs-content';
import { DOCS_LOCALES, isDocsLocale } from '@/docs/docs-locale';
import { resolveDocsRoute } from '@/docs/docs-routes';
import { categoriesOf, findCategory } from '@/docs/navigation/docs-categories';
import { DOCS_SECTIONS, docsSection } from '@/docs/navigation/docs-sections';
interface PageProps {
    readonly params: Promise<{
        locale: string;
        slug: string[];
    }>;
}
export async function generateStaticParams() {
    const params: {
        locale: string;
        slug: string[];
    }[] = [];
    for (const locale of DOCS_LOCALES) {
        for (const section of DOCS_SECTIONS) {
            const prefix = section.id === 'manual' ? [] : [section.id];
            if (prefix.length > 0)
                params.push({ locale, slug: prefix });
            for (const category of categoriesOf(section.id))
                params.push({ locale, slug: [...prefix, category.id] });
        }
        for (const route of await listArticleRoutes(locale)) {
            const prefix = route.section === 'manual' ? [] : [route.section];
            params.push({ locale, slug: [...prefix, route.category, route.slug] });
        }
    }
    return params;
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    if (!isDocsLocale(locale))
        return {};
    const route = resolveDocsRoute(slug);
    if (!route)
        return {};
    if (route.kind === 'section') {
        const section = docsSection(route.section);
        return { title: section.title, description: section.description };
    }
    if (route.kind === 'category') {
        const category = findCategory(route.section, route.category);
        return category ? { title: category.title, description: category.description } : {};
    }
    const article = await loadArticle(locale, route.section, route.category, route.article);
    return article ? { title: article.title, description: article.description } : {};
}
export default async function DocsSlugPage({ params }: PageProps) {
    const { locale, slug } = await params;
    if (!isDocsLocale(locale))
        notFound();
    const route = resolveDocsRoute(slug);
    if (!route)
        notFound();
    if (route.kind === 'section') {
        const tree = await loadSectionTree(locale, route.section);
        if (route.section === 'tutorial')
            return <TutorialHome tree={tree}/>;
        if (route.section === 'referencia')
            return <ReferenceHome tree={tree}/>;
        notFound();
    }
    if (route.kind === 'category') {
        const tree = await loadCategory(locale, route.section, route.category);
        if (!tree)
            notFound();
        return <DocsCategoryPage locale={locale} section={route.section} tree={tree}/>;
    }
    const article = await loadArticle(locale, route.section, route.category, route.article);
    if (!article)
        notFound();
    return <DocsArticle locale={locale} article={article}/>;
}
