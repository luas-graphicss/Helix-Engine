import type { ReactNode } from 'react';
import type { SectionTree } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { DocsFooter } from './docs-footer';
import { DocsHeader } from './docs-header';
import { DocsSidebar } from './docs-sidebar';
export function DocsShell({ locale, sections, children }: {
    locale: DocsLocale;
    sections: readonly SectionTree[];
    children: ReactNode;
}) {
    return (<div className="docs-root flex min-h-dvh flex-col bg-background text-foreground">
      <DocsHeader locale={locale} sections={sections}/>
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 px-4 lg:px-6">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border-strong/60 py-8 pr-5 lg:block">
          <DocsSidebar locale={locale} sections={sections}/>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <DocsFooter locale={locale}/>
    </div>);
}
