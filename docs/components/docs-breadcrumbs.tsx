import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
export interface Crumb {
    readonly label: string;
    readonly href?: string;
}
export function DocsBreadcrumbs({ crumbs }: {
    crumbs: readonly Crumb[];
}) {
    return (<nav aria-label="Você está em" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {crumbs.map((crumb, index) => (<Fragment key={`${crumb.label}-${index}`}>
          {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden/>}
          {crumb.href ? (<Link href={crumb.href} className="transition-colors hover:text-foreground">
              {crumb.label}
            </Link>) : (<span className="text-foreground" aria-current="page">
              {crumb.label}
            </span>)}
        </Fragment>))}
    </nav>);
}
