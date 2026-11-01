'use client';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMPTY_WELL_CLASS } from '@/engine/ui/surface-styles';
import { useHub } from '../hub-context';
import { filterProjects } from '../search/filter-projects';
import { TrashList } from '../trash/trash-list';
export function TrashSection() {
    const { registry, search, setSearch } = useHub();
    const records = filterProjects(registry.trashed, search);
    const filteredOut = records.length === 0 && registry.trashed.length > 0;
    return (<div className="p-6">
      {filteredOut ? (<div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', EMPTY_WELL_CLASS)}>
          <Search className="size-5 text-muted-foreground" aria-hidden/>
          <p className="text-xs text-muted-foreground">
            Nenhum jogo na lixeira com <span className="font-medium text-foreground">“{search}”</span> no nome.
          </p>
          <Button size="xs" variant="ghost" onClick={() => setSearch('')}>
            Limpar busca
          </Button>
        </div>) : (<TrashList records={records}/>)}
    </div>);
}
