import type { Article } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { docsCategoryPath, docsSectionPath } from '../docs-routes';
import { findCategory } from '../navigation/docs-categories';
import { docsSection } from '../navigation/docs-sections';
import { MarkdownArticle } from '../render/markdown-renderer';
import { DocsBreadcrumbs } from './docs-breadcrumbs';
import { DocsPager } from './docs-pager';
import { DocsToc } from './docs-toc';
export function DocsArticle({ locale, article }: {
    locale: DocsLocale;
    article: Article;
}) {
    const section = docsSection(article.section);
    const category = findCategory(article.section, article.category);
    return (<div className="flex gap-12 py-8 lg:py-10 lg:pl-10">
      <article className="min-w-0 max-w-3xl flex-1">
        <DocsBreadcrumbs crumbs={[
            { label: section.label, href: docsSectionPath(section.id, locale) },
            ...(category ? [{ label: category.title, href: docsCategoryPath(section.id, category.id, locale) }] : []),
            { label: article.title },
        ]}/>
        <header className="mt-5 flex flex-col gap-3 border-b border-border-strong pb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance lg:text-4xl">{article.title}</h1>
          {article.description && <p className="text-lg leading-relaxed text-muted-foreground text-pretty">{article.description}</p>}
        </header>
        <div className="docs-prose mt-8">
          <MarkdownArticle body={article.body}/>
        </div>
        <footer className="mt-16 border-t border-border-strong pt-8">
          <DocsPager previous={article.previous} next={article.next}/>
        </footer>
      </article>
      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-24">
          <DocsToc outline={article.outline}/>
        </div>
      </aside>
    </div>);
}
