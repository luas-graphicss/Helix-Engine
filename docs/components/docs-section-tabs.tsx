'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { DocsLocale } from '../docs-locale';
import { docsSectionPath, sectionFromPathname } from '../docs-routes';
import { DOCS_SECTIONS } from '../navigation/docs-sections';
export function DocsSectionTabs({ locale, className }: {
    locale: DocsLocale;
    className?: string;
}) {
    const pathname = usePathname();
    const active = sectionFromPathname(pathname, locale);
    return (<nav aria-label="Seções da documentação" className={cn('flex h-full items-stretch gap-1', className)}>
      {DOCS_SECTIONS.map((section) => {
            const isActive = section.id === active;
            return (<Link key={section.id} href={docsSectionPath(section.id, locale)} aria-current={isActive ? 'page' : undefined} className={cn('relative flex items-center px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-primary', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {section.label}
            <span aria-hidden className={cn('absolute inset-x-3 bottom-0 h-0.5 rounded-t-sm bg-primary transition-opacity', isActive ? 'opacity-100' : 'opacity-0')}/>
          </Link>);
        })}
    </nav>);
}
