'use client';
import { Timer } from 'lucide-react';
import { threadLoad, type JobMonitor } from '@/engine/editor/jobs/job-load';
import type { JobBenchmarkControl } from '@/engine/editor/jobs/use-job-benchmark';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { LANE_GRID_CLASS, ThreadLane } from './thread-lane';
const DISABLED_NOTICE = 'Threads desligadas nesta cena: os jobs rodam na thread principal, um por vez.';
const UNAVAILABLE_NOTICE = 'Este navegador não liberou threads: os jobs rodam na thread principal, um por vez.';
type ThreadsViewProps = {
    monitor: JobMonitor;
    benchmark: JobBenchmarkControl;
};
export function ThreadsView({ monitor, benchmark }: ThreadsViewProps) {
    const session = useEditorSession();
    const { snapshot, samples } = monitor;
    const untouched = snapshot.totals.scheduled === 0;
    const measuring = benchmark.state.status === 'running';
    return (<div className="flex flex-col">
      {snapshot.mode === 'inline' && (<p className="border-b border-border bg-surface-sunken/60 px-3 py-1.5 text-2xs leading-relaxed text-pretty text-muted-foreground">
          {session.scene.jobs.enabled ? UNAVAILABLE_NOTICE : DISABLED_NOTICE}
        </p>)}
      <ol aria-label="Threads de jobs" className="flex flex-col pt-1">
        {snapshot.threads.map((thread) => (<ThreadLane key={thread.index} thread={thread} load={threadLoad(samples, thread.index)} now={snapshot.now}/>))}
      </ol>
      <div aria-hidden className={LANE_GRID_CLASS}>
        <span />
        <div className="flex justify-between font-mono text-3xs text-muted-foreground">
          <span>−10 s</span>
          <span>agora</span>
        </div>
      </div>
      {untouched && (<div className="flex flex-wrap items-center gap-2 px-2 py-2">
          <p className="text-2xs text-muted-foreground">Nenhum job rodou nesta sessão.</p>
          <ActionButton icon={Timer} disabled={measuring} onClick={benchmark.run}>
            Medir ganho das threads
          </ActionButton>
        </div>)}
    </div>);
}
