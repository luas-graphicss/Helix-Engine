'use client';
import { useState } from 'react';
import { Images, LoaderCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { SearchField } from '@/engine/ui/search-field';
import type { MaterialDocument } from '@/engine/materials/material-document';
import type { MaterialLibraryStatus } from '@/engine/materials/material-library';
import { materialCaption, MaterialSwatch } from './material-swatch';
type MaterialLibraryListProps = {
    documents: MaterialDocument[];
    status: MaterialLibraryStatus;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onImport: () => void;
};
export function MaterialLibraryList({ documents, status, selectedId, onSelect, onCreate, onImport }: MaterialLibraryListProps) {
    const [query, setQuery] = useState('');
    const normalized = query.trim().toLowerCase();
    const visible = normalized ? documents.filter((document) => document.name.toLowerCase().includes(normalized)) : documents;
    return (<aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-sunken/40">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        <span className="flex-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Biblioteca</span>
        <span className="font-mono text-[10px] text-muted-foreground">{documents.length}</span>
        <IconButton label="Importar conjunto PBR (imagens)" size="sm" onClick={onImport}>
          <Images />
        </IconButton>
        <IconButton label="Novo material" size="sm" onClick={onCreate}>
          <Plus />
        </IconButton>
      </div>
      <div className="px-2 py-1.5">
        <SearchField placeholder="Filtrar materiais" value={query} onChange={setQuery}/>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1 pb-2">
        {status === 'loading' && documents.length === 0 && (<p className="flex items-center gap-2 px-2 py-3 text-2xs text-muted-foreground">
            <LoaderCircle className="size-3 animate-spin" aria-hidden/> Carregando biblioteca…
          </p>)}
        {status !== 'loading' && visible.length === 0 && (<p className="px-2 py-3 text-2xs leading-relaxed text-pretty text-muted-foreground">
            {documents.length === 0 ? 'Nenhum material ainda. Crie um novo ou importe imagens PBR.' : 'Nenhum material corresponde ao filtro.'}
          </p>)}
        <ul className="flex flex-col gap-px" role="listbox" aria-label="Materiais da biblioteca">
          {visible.map((document) => {
            const active = document.id === selectedId;
            return (<li key={document.id} role="option" aria-selected={active}>
                <button type="button" onClick={() => onSelect(document.id)} className={cn('flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left transition-colors', active ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : 'hover:bg-highlight')}>
                  <MaterialSwatch document={document} className="size-9"/>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('truncate text-2xs', active ? 'font-medium text-foreground' : 'text-foreground/90')}>{document.name}</span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">{materialCaption(document)}</span>
                  </span>
                </button>
              </li>);
        })}
        </ul>
      </div>
    </aside>);
}
