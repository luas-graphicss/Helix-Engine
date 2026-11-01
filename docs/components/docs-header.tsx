import Link from 'next/link';
import { ArrowUpRight, Globe } from 'lucide-react';
import { ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
import { HUB_PATH } from '@/engine/hub/hub-routes';
import type { SectionTree } from '../content/docs-content';
import { DOCS_LOCALE_LABEL, DOCS_LOCALE_TAG, type DocsLocale } from '../docs-locale';
import { DocsBrand } from './docs-brand';
import { DocsMobileNav } from './docs-mobile-nav';
import { DocsSearch } from './docs-search';
import { DocsSectionTabs } from './docs-section-tabs';
export function DocsHeader({ locale, sections }: {
    locale: DocsLocale;
    sections: readonly SectionTree[];
}) {
    return (<header className="sticky top-0 z-40 border-b border-border-strong bg-background/85 shadow-[inset_0_1px_0_0_var(--bevel)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center gap-4 px-4 lg:px-6">
        <DocsMobileNav locale={locale} sections={sections}/>
        <DocsBrand locale={locale}/>
        <DocsSectionTabs locale={locale} className="ml-4 hidden md:flex"/>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <DocsSearch locale={locale}/>
          </div>
          <span className="hidden items-center rounded-sm border border-border-strong px-2 py-1 font-mono text-2xs text-muted-foreground lg:inline-flex" title="Versão da engine documentada">
            {ENGINE_VERSION_LABEL}
          </span>
          <span className="hidden items-center gap-1.5 rounded-sm border border-border-strong px-2 py-1 font-mono text-2xs text-muted-foreground lg:inline-flex" title={DOCS_LOCALE_LABEL[locale]}>
            <Globe className="size-3" aria-hidden/>
            {DOCS_LOCALE_TAG[locale]}
          </span>
          <Link href={HUB_PATH} target="_blank" rel="noopener" className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-raised transition-colors hover:bg-primary/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Abrir a engine
            <ArrowUpRight className="size-4" aria-hidden/>
          </Link>
        </div>
      </div>
      <div className="border-t border-border-strong/60 px-4 md:hidden">
        <DocsSectionTabs locale={locale} className="h-10"/>
      </div>
    </header>);
}
