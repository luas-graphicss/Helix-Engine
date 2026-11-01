'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { History, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMPTY_WELL_CLASS } from '@/engine/ui/surface-styles';
import type { ProjectRecord } from '@/engine/project/project-record';
import { listProjectSnapshots, sceneSnapshotsKey } from '@/engine/project/scene-snapshots';
import { formatDateTime, formatRelativeTime, plural } from '@/engine/core/format/format-time';
import { useHub } from '../hub-context';
import { HubDialogShell } from './hub-dialog-shell';
export function HistoryDialog({ record, onClose }: {
    record: ProjectRecord;
    onClose(): void;
}) {
    const { actions } = useHub();
    const { data: snapshots, error, isLoading, mutate } = useSWR(sceneSnapshotsKey(record.id), () => listProjectSnapshots(record), { revalidateOnFocus: false });
    const [restoring, setRestoring] = useState<string | null>(null);
    const restore = async (key: string) => {
        setRestoring(key);
        try {
            await actions.restoreSnapshot(record, key);
            await mutate();
        }
        finally {
            setRestoring(null);
        }
    };
    return (<HubDialogShell title={`Histórico de "${record.name}"`} description="Versões anteriores da cena, guardadas automaticamente a cada salvamento. Restaurar uma delas troca a cena atual, que fica guardada aqui como nova versão." dismissible={restoring === null} onClose={onClose} className="max-w-lg">
      {isLoading && <p className="py-6 text-center font-mono text-2xs text-muted-foreground">Lendo as versões…</p>}
      {error && (<p role="alert" className="text-xs text-destructive">
          Não foi possível ler o histórico: {error instanceof Error ? error.message : String(error)}
        </p>)}
      {snapshots && snapshots.length === 0 && (<div className={cn('flex flex-col items-center gap-2 px-6 py-8 text-center', EMPTY_WELL_CLASS)}>
          <History className="size-5 text-muted-foreground" aria-hidden/>
          <p className="text-xs text-muted-foreground text-pretty">Ainda não há versões anteriores. Elas aparecem conforme você trabalha e o jogo vai sendo salvo.</p>
        </div>)}
      {snapshots && snapshots.length > 0 && (<div className="flex flex-col gap-2">
          <p className="font-mono text-3xs text-muted-foreground">{plural(snapshots.length, 'versão guardada', 'versões guardadas')}, da mais recente à mais antiga.</p>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-sm border border-border bg-surface-sunken shadow-well">
            {snapshots.map((snapshot) => (<li key={snapshot.key} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-foreground">{formatDateTime(snapshot.savedAt)}</span>
                  <span className="font-mono text-3xs text-muted-foreground">{formatRelativeTime(snapshot.savedAt)}</span>
                </div>
                <Button size="xs" variant="outline" disabled={restoring !== null} onClick={() => void restore(snapshot.key)}>
                  <RotateCcw data-icon="inline-start" aria-hidden/>
                  {restoring === snapshot.key ? 'Restaurando…' : 'Restaurar'}
                </Button>
              </li>))}
          </ul>
        </div>)}
    </HubDialogShell>);
}
