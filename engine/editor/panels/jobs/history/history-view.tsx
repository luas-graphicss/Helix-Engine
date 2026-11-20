import type { JobOutcomeStatus, JobRecord } from '@/engine/jobs/system/job-history';
import { cn } from '@/lib/utils';
import { formatMilliseconds, threadName } from '../shared/job-format';
const STATUS_LABEL: Record<JobOutcomeStatus, string> = {
    completed: 'concluído',
    failed: 'falhou',
    cancelled: 'cancelado',
    timeout: 'tempo esgotado',
};
const STATUS_CLASS: Record<JobOutcomeStatus, string> = {
    completed: 'text-success',
    failed: 'text-destructive',
    cancelled: 'text-muted-foreground',
    timeout: 'text-warning',
};
const HEADER_CLASS = 'px-2 py-1 font-semibold';
const NUMBER_CELL_CLASS = 'px-2 py-1 text-right font-mono tabular-nums text-foreground/80';
const NOT_STARTED = '—';
function HistoryRow({ record }: {
    record: JobRecord;
}) {
    const { startedAt, batch } = record;
    return (<tr className="border-b border-border/60">
      <td className="max-w-0 truncate px-2 py-1 text-foreground" title={record.name}>
        {record.name}
        {batch && <span className="text-muted-foreground"> · lote {batch.index + 1}/{batch.count}</span>}
      </td>
      <td className="max-w-0 truncate px-2 py-1 text-muted-foreground" title={record.label}>
        {record.label || NOT_STARTED}
      </td>
      <td className={NUMBER_CELL_CLASS}>{record.thread === null ? NOT_STARTED : threadName(record.thread)}</td>
      <td className={NUMBER_CELL_CLASS}>{startedAt === null ? NOT_STARTED : formatMilliseconds(startedAt - record.queuedAt)}</td>
      <td className={NUMBER_CELL_CLASS}>{startedAt === null ? NOT_STARTED : formatMilliseconds(record.finishedAt - startedAt)}</td>
      <td className={cn('px-2 py-1 whitespace-nowrap', STATUS_CLASS[record.status])} title={record.error ?? undefined}>
        {STATUS_LABEL[record.status]}
      </td>
    </tr>);
}
export function HistoryView({ history }: {
    history: readonly JobRecord[];
}) {
    if (history.length === 0)
        return <p className="px-3 py-2 text-2xs text-muted-foreground">Os jobs que terminarem aparecem aqui, do mais recente para o mais antigo.</p>;
    return (<table className="w-full table-fixed border-collapse text-2xs">
      <thead className="sticky top-0 border-b border-border bg-surface-raised text-3xs tracking-[0.08em] text-foreground/90 uppercase">
        <tr>
          <th scope="col" className={cn(HEADER_CLASS, 'text-left')}>Job</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-1/5 text-left')}>Origem</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-14 text-right')}>Thread</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-20 text-right')}>Espera</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-20 text-right')}>Execução</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-28 text-left')}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {[...history].reverse().map((record) => (<HistoryRow key={record.id} record={record}/>))}
      </tbody>
    </table>);
}
