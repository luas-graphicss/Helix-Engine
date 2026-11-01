'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryTree, SectionTree } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { sectionFromPathname } from '../docs-routes';
import { DocsIcon } from '../navigation/docs-icons';
interface DocsSidebarProps {
    readonly locale: DocsLocale;
    readonly sections: readonly SectionTree[];
    readonly onNavigate?: () => void;
}
function CategoryGroup({ tree, pathname, onNavigate }: {
    tree: CategoryTree;
    pathname: string;
    onNavigate?: () => void;
}) {
    const containsActive = pathname === tree.path || tree.articles.some((article) => article.path === pathname);
    const [open, setOpen] = useState(containsActive);
    const expanded = open || containsActive;
    const { category } = tree;
    return (<li>
      <div className="flex items-center">
        <Link href={tree.path} onClick={onNavigate} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1.5 pr-1 pl-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-primary', containsActive ? 'text-foreground' : 'text-foreground/80')}>
          <DocsIcon id={category.icon} className={cn('size-4 shrink-0', containsActive ? 'text-primary' : 'text-muted-foreground')}/>
          <span className="truncate">{category.title}</span>
        </Link>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={expanded} aria-label={expanded ? `Recolher ${category.title}` : `Expandir ${category.title}`} className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground focus-visible:outline-1 focus-visible:outline-primary">
          <ChevronRight className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-90')} aria-hidden/>
        </button>
      </div>
      {expanded && (<ul className="my-1 ml-4 flex flex-col border-l border-border-strong">
          {tree.articles.map((article) => {
                const isActive = article.path === pathname;
                return (<li key={article.slug}>
                <Link href={article.path} onClick={onNavigate} aria-current={isActive ? 'page' : undefined} className={cn('-ml-px block border-l py-1.5 pl-4 text-[0.8125rem] leading-snug transition-colors focus-visible:outline-1 focus-visible:outline-primary', isActive ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground')}>
                  {article.title}
                </Link>
              </li>);
            })}
        </ul>)}
    </li>);
}
export function DocsSidebar({ locale, sections, onNavigate }: DocsSidebarProps) {
    const pathname = usePathname();
    const activeSection = sectionFromPathname(pathname, locale);
    const tree = sections.find((entry) => entry.section.id === activeSection);
    if (!tree)
        return null;
    return (<nav aria-label={`Navegação: ${tree.section.label}`} className="flex flex-col gap-4">
      <div className="px-2">
        <p className="font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">{tree.section.label}</p>
      </div>
      <ul className="flex flex-col gap-0.5">
        {tree.categories.map((category) => (<CategoryGroup key={category.category.id} tree={category} pathname={pathname} onNavigate={onNavigate}/>))}
      </ul>
    </nav>);
}
