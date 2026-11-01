import Link from 'next/link';
import type { CategoryTree } from '../content/docs-content';
import { DocsIcon } from '../navigation/docs-icons';
function articleCount(count: number): string {
    return count === 1 ? '1 artigo' : `${count} artigos`;
}
export function DocsCategoryCard({ tree }: {
    tree: CategoryTree;
}) {
    const { category, articles, path } = tree;
    return (<Link href={path} className="group flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-5 shadow-bevel transition-colors hover:border-muted-foreground/40 hover:bg-surface-raised focus-visible:outline-1 focus-visible:outline-primary">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-sm border border-border-strong bg-surface-sunken text-primary shadow-well">
          <DocsIcon id={category.icon} className="size-[18px]"/>
        </span>
        <span className="font-mono text-2xs text-muted-foreground">{articleCount(articles.length)}</span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground">{category.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{category.description}</p>
      </div>
    </Link>);
}
