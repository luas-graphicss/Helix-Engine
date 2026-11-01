'use client';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { CornerDownLeft, FileText, Hash, LoaderCircle, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { SearchRecord } from '../content/docs-content';
import type { DocsLocale } from '../docs-locale';
import { docsSearchPath } from '../docs-routes';
import { searchRecords, type SearchHit } from '../search/search-query';
async function fetchIndex(url: string): Promise<SearchRecord[]> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Índice de busca indisponível (${response.status}).`);
    return (await response.json()) as SearchRecord[];
}
function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}
function useSearchShortcut(open: () => void): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                open();
            }
            else if (event.key === '/' && !isTextEntry(event.target)) {
                event.preventDefault();
                open();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);
}
function hitHref(hit: SearchHit): string {
    return hit.heading ? `${hit.record.path}#${hit.heading.id}` : hit.record.path;
}
function SearchButton({ onClick, children, className }: {
    onClick: () => void;
    children: ReactNode;
    className?: string;
}) {
    return (<button type="button" onClick={onClick} className={cn('flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface-sunken px-3 text-sm text-muted-foreground shadow-well transition-colors hover:border-muted-foreground/40 hover:text-foreground focus-visible:outline-1 focus-visible:outline-primary', className)}>
      <Search className="size-4 shrink-0" aria-hidden/>
      <span className="flex-1 truncate text-left">{children}</span>
      <kbd className="hidden rounded-sm border border-border-strong bg-surface-raised px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-block">Ctrl K</kbd>
    </button>);
}
interface DocsSearchProps {
    readonly locale: DocsLocale;
    readonly variant?: 'header' | 'hero';
}
export function DocsSearch({ locale, variant = 'header' }: DocsSearchProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const { data: records, error, isLoading } = useSWR(open ? docsSearchPath(locale) : null, fetchIndex, { revalidateOnFocus: false });
    const hits = useMemo(() => (records ? searchRecords(records, query) : []), [records, query]);
    useSearchShortcut(() => setOpen(true));
    useEffect(() => {
        setCursor(0);
    }, [query]);
    const navigate = (hit: SearchHit) => {
        setOpen(false);
        setQuery('');
        router.push(hitHref(hit));
    };
    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229)
            return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((value) => Math.min(hits.length - 1, value + 1));
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((value) => Math.max(0, value - 1));
        }
        else if (event.key === 'Enter' && hits[cursor]) {
            event.preventDefault();
            navigate(hits[cursor]);
        }
    };
    const grouped = useMemo(() => {
        const groups = new Map<string, SearchHit[]>();
        for (const hit of hits) {
            const list = groups.get(hit.record.sectionLabel) ?? [];
            list.push(hit);
            groups.set(hit.record.sectionLabel, list);
        }
        return Array.from(groups.entries());
    }, [hits]);
    return (<>
      {variant === 'hero' ? (<SearchButton onClick={() => setOpen(true)} className="h-12 w-full max-w-xl px-4 text-base">
          Buscar na documentação: física, Luau, terreno, atalhos…
        </SearchButton>) : (<SearchButton onClick={() => setOpen(true)} className="w-full md:w-64 lg:w-72">
          Buscar…
        </SearchButton>)}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl" initialFocus={inputRef}>
          <DialogTitle className="sr-only">Buscar na documentação</DialogTitle>
          <div className="flex items-center gap-3 border-b border-border-strong px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden/>
            <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="O que você procura?" aria-label="Buscar na documentação" aria-controls={listId} aria-activedescendant={hits[cursor] ? `${listId}-${cursor}` : undefined} role="combobox" aria-expanded={hits.length > 0} autoComplete="off" spellCheck={false} className="h-14 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"/>
            {isLoading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Carregando índice"/>}
            <kbd className="hidden rounded-sm border border-border-strong bg-surface-raised px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-block">Esc</kbd>
          </div>

          <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[60vh] overflow-y-auto p-2">
            {error && <p className="px-3 py-6 text-center text-sm text-destructive">Não foi possível carregar o índice de busca.</p>}
            {!error && query.trim().length > 1 && hits.length === 0 && !isLoading && (<p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nada encontrado para <span className="text-foreground">“{query}”</span>. Tente outro termo ou navegue pelas categorias.
              </p>)}
            {!error && query.trim().length <= 1 && (<p className="px-3 py-8 text-center text-sm text-muted-foreground">Digite para buscar em artigos, seções e na referência da API.</p>)}
            {grouped.map(([sectionLabel, group]) => (<div key={sectionLabel} className="mb-2">
                <p className="px-3 pt-2 pb-1 font-mono text-2xs tracking-[0.18em] text-muted-foreground uppercase">{sectionLabel}</p>
                <ul className="flex flex-col gap-0.5">
                  {group.map((hit) => {
                const index = hits.indexOf(hit);
                const isActive = index === cursor;
                return (<li key={hitHref(hit)}>
                        <button type="button" id={`${listId}-${index}`} role="option" aria-selected={isActive} onMouseEnter={() => setCursor(index)} onClick={() => navigate(hit)} className={cn('flex w-full items-start gap-3 rounded-sm px-3 py-2.5 text-left transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-highlight')}>
                          {hit.heading ? <Hash className={cn('mt-0.5 size-4 shrink-0', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')} aria-hidden/> : <FileText className={cn('mt-0.5 size-4 shrink-0', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')} aria-hidden/>}
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium">{hit.heading ? hit.heading.text : hit.record.title}</span>
                            <span className={cn('truncate text-xs', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                              {hit.record.categoryLabel}
                              {hit.heading ? ` › ${hit.record.title}` : hit.record.description ? ` — ${hit.record.description}` : ''}
                            </span>
                          </span>
                          {isActive && <CornerDownLeft className="mt-1 size-3.5 shrink-0 text-primary-foreground/80" aria-hidden/>}
                        </button>
                      </li>);
            })}
                </ul>
              </div>))}
          </div>

          <div className="flex items-center gap-4 border-t border-border-strong bg-surface-sunken px-4 py-2 font-mono text-2xs text-muted-foreground">
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
            <span>esc fechar</span>
            <span className="ml-auto">{records ? `${records.length} artigos indexados` : ''}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>);
}
