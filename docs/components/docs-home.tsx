import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ArticleSummary, SectionTree } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { docsSectionPath } from '../docs-routes';
import { DocsIcon, type DocsIconId } from '../navigation/docs-icons';
import { docsSection } from '../navigation/docs-sections';
import { DocsCategoryCard } from './docs-category-card';
import { DocsHero } from './docs-hero';
import { DocsSearch } from './docs-search';
interface StartHere {
    readonly icon: DocsIconId;
    readonly label: string;
    readonly article: ArticleSummary | null;
}
function findArticle(sections: readonly SectionTree[], section: string, category: string, slug: string): ArticleSummary | null {
    const tree = sections.find((entry) => entry.section.id === section);
    return tree?.categories.find((entry) => entry.category.id === category)?.articles.find((article) => article.slug === slug) ?? null;
}
export function DocsHome({ locale, sections }: {
    locale: DocsLocale;
    sections: readonly SectionTree[];
}) {
    const manual = sections.find((entry) => entry.section.id === 'manual');
    const meta = docsSection('manual');
    const startHere: StartHere[] = [
        { icon: 'compass', label: 'Entenda a engine', article: findArticle(sections, 'manual', 'visao-geral', 'introducao') },
        { icon: 'rocket', label: 'Faça o primeiro jogo', article: findArticle(sections, 'tutorial', 'primeiros-passos', 'primeiro-jogo') },
        { icon: 'code', label: 'Escreva o primeiro script', article: findArticle(sections, 'tutorial', 'programando', 'primeiro-script') },
    ];
    return (<div className="flex flex-col gap-14 py-8 lg:py-10 lg:pl-10">
      <DocsHero eyebrow="Documentação" title={meta.title} description={meta.description}>
        <DocsSearch locale={locale} variant="hero"/>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href={docsSectionPath('tutorial', locale)} className="flex items-center gap-1 text-primary transition-colors hover:text-foreground">
            Começar pelos tutoriais
            <ArrowRight className="size-3.5" aria-hidden/>
          </Link>
          <Link href={docsSectionPath('referencia', locale)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            Referência da API
            <ArrowRight className="size-3.5" aria-hidden/>
          </Link>
        </div>
      </DocsHero>

      <section className="flex flex-col gap-5">
        <h2 className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">Comece por aqui</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {startHere.map(({ icon, label, article }) => article && (<Link key={article.path} href={article.path} className="group flex items-start gap-3 rounded-md border border-border-strong bg-surface p-4 shadow-bevel transition-colors hover:border-muted-foreground/40 hover:bg-surface-raised focus-visible:outline-1 focus-visible:outline-primary">
                  <DocsIcon id={icon} className="mt-0.5 size-5 shrink-0 text-primary"/>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-foreground">{article.title}</span>
                  </span>
                </Link>))}
        </div>
      </section>

      {manual && (<section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">Explore o manual</h2>
            <p className="text-xs text-muted-foreground">
              {manual.categories.length} categorias · {manual.categories.reduce((total, category) => total + category.articles.length, 0)} artigos
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {manual.categories.map((tree) => (<DocsCategoryCard key={tree.category.id} tree={tree}/>))}
          </div>
        </section>)}
    </div>);
}
