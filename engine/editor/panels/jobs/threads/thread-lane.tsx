import { LOAD_BUCKETS, averageLoad, type LoadBucket } from '@/engine/editor/jobs/job-load';
import type { ThreadSnapshot } from '@/engine/jobs/system/job-system';
import { cn } from '@/lib/utils';
import { describeJob, formatMilliseconds, threadName } from '../shared/job-format';
export const LANE_GRID_CLASS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] items-center gap-2 px-2 @2xl/panel:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,16rem)_2.5rem]';
const RECENT_BUCKETS = 10;
const IDLE_LABEL = 'ociosa';
type ThreadLaneProps = {
    thread: ThreadSnapshot;
    load: readonly LoadBucket[];
    now: number;
};
function LoadStrip({ load }: {
    load: readonly LoadBucket[];
}) {
    const missing = LOAD_BUCKETS - load.length;
    return (<div aria-hidden className="flex h-3.5 items-end gap-px overflow-hidden rounded-xs bg-surface-sunken p-px shadow-well">
      {missing > 0 && <span style={{ flexGrow: missing }}/>}
      {load.map((bucket) => (<span key={bucket.at} className="min-w-0 flex-1 bg-primary/80" style={{ height: `${Math.round(bucket.load * 100)}%` }}/>))}
    </div>);
}
export function ThreadLane({ thread, load, now }: ThreadLaneProps) {
    const { job } = thread;
    const activity = job ? `${describeJob(job.name, job.batch)} · ${formatMilliseconds(now - job.startedAt)}` : IDLE_LABEL;
    const recentLoad = Math.round(averageLoad(load.slice(-RECENT_BUCKETS)) * 100);
    return (<li className={cn(LANE_GRID_CLASS, 'h-row')} title={`${threadName(thread.index)}: ${activity}`}>
      <span className="font-mono text-2xs text-muted-foreground tabular-nums">{threadName(thread.index)}</span>
      <LoadStrip load={load}/>
      <span className={cn('hidden truncate text-2xs @2xl/panel:block', job ? 'text-foreground' : 'text-muted-foreground')}>{activity}</span>
      <span className="text-right font-mono text-2xs text-foreground/80 tabular-nums">{recentLoad}%</span>
    </li>);
}
