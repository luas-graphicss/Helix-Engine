'use client';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { SectionTree } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { DocsSidebar } from './docs-sidebar';
export function DocsMobileNav({ locale, sections }: {
    locale: DocsLocale;
    sections: readonly SectionTree[];
}) {
    const [open, setOpen] = useState(false);
    return (<>
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir navegação" className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground focus-visible:outline-1 focus-visible:outline-primary lg:hidden">
        <Menu className="size-5" aria-hidden/>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-0 left-0 h-dvh max-w-[20rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none border-r border-border-strong p-5 data-open:zoom-in-100 data-closed:zoom-out-100 sm:max-w-[20rem]">
          <DialogTitle className="sr-only">Navegação da documentação</DialogTitle>
          <div className="pt-6">
            <DocsSidebar locale={locale} sections={sections} onNavigate={() => setOpen(false)}/>
          </div>
        </DialogContent>
      </Dialog>
    </>);
}
