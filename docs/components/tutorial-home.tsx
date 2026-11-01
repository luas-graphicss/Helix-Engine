import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import type { SectionTree } from '../content/docs-content';
import { DocsIcon } from '../navigation/docs-icons';
import { DocsHero } from './docs-hero';
export function TutorialHome({ tree }: {
    tree: SectionTree;
}) {
    const firstArticle = tree.categories[0]?.articles[0] ?? null;
    const totalLessons = tree.categories.reduce((total, category) => total + category.articles.length, 0);
    return (<div className="flex flex-col gap-14 py-8 lg:py-10 lg:pl-10">
      <DocsHero eyebrow="Tutoriais" title={tree.section.title} description={tree.section.description}>
        {firstArticle && (<div className="flex flex-wrap items-center gap-4">
            <Link href={firstArticle.path} className="flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-raised transition-colors hover:bg-primary/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Play className="size-4" aria-hidden/>
              Começar pelo capítulo 1
            </Link>
            <p className="text-sm text-muted-foreground">
              {tree.categories.length} capítulos · {totalLessons} lições · sem pré-requisitos
            </p>
          </div>)}
      </DocsHero>

      <ol className="relative flex flex-col gap-10 border-l border-border-strong pl-8 lg:pl-10">
        {tree.categories.map((category, index) => (<li key={category.category.id} className="relative">
            <span aria-hidden className="absolute top-1 -left-8 flex size-[calc(1rem-1px)] -translate-x-1/2 items-center justify-center rounded-full border border-primary bg-background lg:-left-10">
              <span className="size-1.5 rounded-full bg-primary"/>
            </span>
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm text-primary">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex flex-col gap-1.5">
                  <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                    <DocsIcon id={category.category.icon} className="size-5 text-muted-foreground"/>
                    {category.category.title}
                  </h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{category.category.description}</p>
                </div>
              </div>
              <ol className="flex flex-col gap-2">
                {category.articles.map((article, lessonIndex) => (<li key={article.slug}>
                    <Link href={article.path} className="group flex items-start gap-4 rounded-md border border-border-strong bg-surface px-4 py-3.5 shadow-bevel transition-colors hover:border-muted-foreground/40 hover:bg-surface-raised focus-visible:outline-1 focus-visible:outline-primary">
                      <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {index + 1}.{lessonIndex + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{article.title}</span>
                        {article.description && <span className="text-sm leading-relaxed text-muted-foreground">{article.description}</span>}
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden/>
                    </Link>
                  </li>))}
              </ol>
            </div>
          </li>))}
      </ol>
    </div>);
}
