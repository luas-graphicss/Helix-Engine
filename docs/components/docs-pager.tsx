import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArticleSummary } from '../content/docs-content';
function PagerLink({ article, direction }: {
    article: ArticleSummary;
    direction: 'previous' | 'next';
}) {
    const isNext = direction === 'next';
    return (<Link href={article.path} rel={isNext ? 'next' : 'prev'} className={cn('group flex flex-1 flex-col gap-1.5 rounded-md border border-border-strong bg-surface p-4 shadow-bevel transition-colors hover:border-muted-foreground/40 hover:bg-surface-raised focus-visible:outline-1 focus-visible:outline-primary', isNext ? 'items-end text-right' : 'items-start text-left')}>
      <span className="flex items-center gap-1.5 font-mono text-2xs tracking-[0.16em] text-muted-foreground uppercase">
        {!isNext && <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" aria-hidden/>}
        {isNext ? 'Próximo' : 'Anterior'}
        {isNext && <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden/>}
      </span>
      <span className="text-sm font-medium text-foreground text-balance">{article.title}</span>
    </Link>);
}
export function DocsPager({ previous, next }: {
    previous: ArticleSummary | null;
    next: ArticleSummary | null;
}) {
    if (!previous && !next)
        return null;
    return (<nav aria-label="Artigos vizinhos" className="flex flex-col gap-3 sm:flex-row">
      {previous ? <PagerLink article={previous} direction="previous"/> : <div className="hidden flex-1 sm:block"/>}
      {next ? <PagerLink article={next} direction="next"/> : <div className="hidden flex-1 sm:block"/>}
    </nav>);
}
