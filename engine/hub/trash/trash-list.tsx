'use client';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CARD_CLASS, EMPTY_WELL_CLASS } from '@/engine/ui/surface-styles';
import type { ProjectRecord } from '@/engine/project/project-record';
import { formatDateTime, plural } from '@/engine/core/format/format-time';
import { useHub } from '../hub-context';
import { ProjectThumbnail } from '../projects/project-thumbnail';
export function TrashList({ records }: {
    records: readonly ProjectRecord[];
}) {
    const { actions, setDialog } = useHub();
    if (records.length === 0) {
        return (<div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', EMPTY_WELL_CLASS)}>
        <Trash2 className="size-5 text-muted-foreground" aria-hidden/>
        <p className="text-xs text-muted-foreground">A lixeira está vazia. Jogos movidos para cá podem ser restaurados a qualquer momento.</p>
      </div>);
    }
    return (<div className="flex flex-col gap-4">
      <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3', CARD_CLASS)}>
        <p className="min-w-0 flex-1 basis-64 text-xs text-muted-foreground text-pretty">
          {plural(records.length, 'jogo', 'jogos')} na lixeira. Excluir permanentemente apaga a cena, os materiais e os ativos do jogo deste navegador.
        </p>
        <Button size="sm" variant="destructive" className="shrink-0" onClick={() => setDialog({ kind: 'empty-trash' })}>
          <Trash2 data-icon="inline-start" aria-hidden/>
          Esvaziar lixeira
        </Button>
      </div>

      <ul className={cn('flex flex-col divide-y divide-border overflow-hidden', CARD_CLASS)}>
        {records.map((record) => (<li key={record.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
            <ProjectThumbnail record={record} className="w-28 shrink-0 rounded-sm border border-border"/>
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
              <span className="truncate text-xs font-medium text-foreground">{record.name}</span>
              <span className="truncate font-mono text-3xs text-muted-foreground">
                Excluído em {record.deletedAt ? formatDateTime(record.deletedAt) : '—'} · {plural(record.stats.entities, 'ator', 'atores')}
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void actions.restore(record)}>
                <RotateCcw data-icon="inline-start" aria-hidden/>
                Restaurar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDialog({ kind: 'purge', record })}>
                Excluir permanentemente
              </Button>
            </div>
          </li>))}
      </ul>
    </div>);
}
