'use client';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/engine/project/storage-health';
import { cn } from '@/lib/utils';
import { useHub, type TransferJob } from '../hub-context';
import { HubDialogShell } from './hub-dialog-shell';
export function TransferDialog({ job, onClose }: {
    job: TransferJob;
    onClose(): void;
}) {
    const { actions } = useHub();
    const running = job.status === 'running';
    const percent = Math.round(Math.min(1, Math.max(0, job.progress.fraction)) * 100);
    const failures = job.failures ?? [];
    const openImported = () => {
        const record = job.imported;
        onClose();
        if (record)
            actions.openProject(record);
    };
    return (<HubDialogShell title={job.title} dismissible={!running} onClose={onClose} footer={running ? undefined : (<>
            {job.imported && (<Button size="sm" onClick={openImported}>
                Abrir jogo
              </Button>)}
            <Button size="sm" variant={job.imported ? 'outline' : 'default'} onClick={onClose}>
              Fechar
            </Button>
          </>)}>
      <div className="flex flex-col gap-2" aria-live="polite">
        <div className="h-1.5 w-full overflow-hidden rounded-xs border border-border bg-surface-sunken shadow-well">
          <div className={cn('h-full transition-[width] duration-300 ease-out', job.status === 'failed' ? 'bg-destructive' : 'bg-primary')} style={{ width: `${percent}%` }}/>
        </div>
        <div className="flex items-baseline justify-between gap-4 font-mono text-3xs text-muted-foreground">
          <span className="truncate">{job.status === 'failed' ? 'Interrompido' : job.progress.label}</span>
          <span className="tabular-nums">{percent}%</span>
        </div>
      </div>

      {job.status === 'done' && job.download && (<p className="text-xs leading-relaxed text-muted-foreground text-pretty">
          O download de <span className="font-medium text-foreground">{job.download.filename}</span> ({formatBytes(job.download.bytes)}) começou. Se o navegador o bloqueou,{' '}
          <a href={job.download.url} download={job.download.filename} className="text-primary underline underline-offset-2">
            baixe de novo
          </a>
          . Guarde o arquivo fora deste navegador: é ele que traz o jogo de volta.
        </p>)}

      {job.status === 'done' && job.summary && <p className="text-xs text-foreground">{job.summary}</p>}

      {failures.length > 0 && (<ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-sm border border-border bg-surface-sunken p-3 shadow-well" aria-label="Arquivos que não puderam ser importados">
          {failures.map((failure) => (<li key={`${failure.source}:${failure.message}`} className="flex items-start gap-2 text-xs">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden/>
              <span className="min-w-0">
                <span className="font-medium text-foreground">{failure.source}</span>
                <span className="text-muted-foreground"> — {failure.message}</span>
              </span>
            </li>))}
        </ul>)}

      {job.status === 'failed' && (<p role="alert" className="text-xs leading-relaxed text-destructive text-pretty">
          {job.error}
        </p>)}
    </HubDialogShell>);
}
