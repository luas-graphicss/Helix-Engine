import Link from 'next/link';
import { ENGINE_NAME, ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
import { HUB_PATH } from '@/engine/hub/hub-routes';
import type { DocsLocale } from '../docs-locale';
import { docsSectionPath } from '../docs-routes';
import { DOCS_SECTIONS } from '../navigation/docs-sections';
export function DocsFooter({ locale }: {
    locale: DocsLocale;
}) {
    return (<footer className="border-t border-border-strong/60">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p className="font-mono text-xs">
          {ENGINE_NAME} {ENGINE_VERSION_LABEL} · Documentação
        </p>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
          {DOCS_SECTIONS.map((section) => (<Link key={section.id} href={docsSectionPath(section.id, locale)} className="transition-colors hover:text-foreground">
              {section.label}
            </Link>))}
          <Link href={HUB_PATH} className="transition-colors hover:text-foreground">
            Abrir a engine
          </Link>
        </nav>
      </div>
    </footer>);
}
