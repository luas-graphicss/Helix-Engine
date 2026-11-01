import Link from 'next/link';
import { HelixLogo } from '@/engine/boot/helix-logo';
import type { DocsLocale } from '../docs-locale';
import { docsHomePath } from '../docs-routes';
export function DocsBrand({ locale }: {
    locale: DocsLocale;
}) {
    return (<Link href={docsHomePath(locale)} className="flex items-center gap-2.5 rounded-sm focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Documentação da Helix Engine, página inicial">
      <HelixLogo size={22}/>
      <span className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tracking-[0.2em] text-foreground">HELIX</span>
        <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground">DOCS</span>
      </span>
    </Link>);
}
