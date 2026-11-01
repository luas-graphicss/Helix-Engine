import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CategoryTree } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { docsSectionPath, type DocsSectionId } from '../docs-routes';
import { DocsIcon } from '../navigation/docs-icons';
import { docsSection } from '../navigation/docs-sections';
import { DocsBreadcrumbs } from './docs-breadcrumbs';
export function DocsCategoryPage({ locale, section, tree }: {
    locale: DocsLocale;
    section: DocsSectionId;
    tree: CategoryTree;
}) {
    const sectionMeta = docsSection(section);
    const { category, articles } = tree;
    const isTutorial = section === 'tutorial';
    return (<div className="max-w-3xl py-8 lg:py-10 lg:pl-10">
      <DocsBreadcrumbs crumbs={[{ label: sectionMeta.label, href: docsSectionPath(section, locale) }, { label: category.title }]}/>
      <header className="mt-5 flex items-start gap-4 border-b border-border-strong pb-8">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-primary shadow-bevel">
          <DocsIcon id={category.icon} className="size-6"/>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance lg:text-4xl">{category.title}</h1>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">{category.description}</p>
        </div>
      </header>

      <ol className="mt-8 flex flex-col gap-2">
        {articles.map((article, index) => (<li key={article.slug}>
            <Link href={article.path} className="group flex items-start gap-4 rounded-md border border-border-strong bg-surface p-4 shadow-bevel transition-colors hover:border-muted-foreground/40 hover:bg-surface-raised focus-visible:outline-1 focus-visible:outline-primary">
              {isTutorial && <span className="mt-0.5 w-7 shrink-0 font-mono text-sm text-primary">{String(index + 1).padStart(2, '0')}</span>}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium text-foreground">{article.title}</span>
                {article.description && <span className="text-sm leading-relaxed text-muted-foreground">{article.description}</span>}
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden/>
            </Link>
          </li>))}
      </ol>
    </div>);
}
