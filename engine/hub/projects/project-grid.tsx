'use client';
import { FolderInput, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMPTY_WELL_CLASS, RAISED_CLASS } from '@/engine/ui/surface-styles';
import type { ProjectRecord } from '@/engine/project/project-record';
import { useHub } from '../hub-context';
import { ProjectCard } from './project-card';
interface ProjectGridProps {
    records: readonly ProjectRecord[];
    total: number;
}
export function ProjectGrid({ records, total }: ProjectGridProps) {
    if (total === 0)
        return <NoProjectsYet />;
    if (records.length === 0)
        return <NoSearchResults />;
    return (<ul className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
      {records.map((record) => (<li key={record.id}>
          <ProjectCard record={record}/>
        </li>))}
    </ul>);
}
function NoProjectsYet() {
    const { actions } = useHub();
    return (<div className={cn('flex flex-col items-center gap-4 px-6 py-12 text-center', EMPTY_WELL_CLASS)}>
      <div className={cn('flex size-10 items-center justify-center rounded-sm text-primary', RAISED_CLASS)}>
        <Plus className="size-5" aria-hidden/>
      </div>
      <div className="flex max-w-md flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">Nenhum jogo neste navegador ainda</p>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          Seus jogos ficam guardados neste navegador, com cenas, materiais e ativos. Crie um a partir de um template acima ou traga um arquivo <code className="font-mono">.helix</code> exportado
          de outro lugar.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={() => void actions.createProject('baseplate')}>
          <Plus data-icon="inline-start" aria-hidden/>
          Criar a partir da Baseplate
        </Button>
        <Button size="sm" variant="outline" onClick={() => actions.pickFilesToImport()}>
          <FolderInput data-icon="inline-start" aria-hidden/>
          Importar arquivo
        </Button>
      </div>
    </div>);
}
function NoSearchResults() {
    const { search, setSearch } = useHub();
    return (<div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', EMPTY_WELL_CLASS)}>
      <Search className="size-5 text-muted-foreground" aria-hidden/>
      <p className="text-xs text-muted-foreground">
        Nenhum jogo com <span className="font-medium text-foreground">“{search}”</span> no nome.
      </p>
      <Button size="xs" variant="ghost" onClick={() => setSearch('')}>
        Limpar busca
      </Button>
    </div>);
}
