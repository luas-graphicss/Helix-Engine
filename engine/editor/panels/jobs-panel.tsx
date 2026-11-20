'use client';
import { useState } from 'react';
import { Eraser } from 'lucide-react';
import { plural } from '@/engine/core/format/format-time';
import type { JobMonitor } from '@/engine/editor/jobs/job-load';
import { useJobBenchmark, type JobBenchmarkControl } from '@/engine/editor/jobs/use-job-benchmark';
import { useJobMonitor } from '@/engine/editor/jobs/use-job-monitor';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { JobSystemSnapshot } from '@/engine/jobs/system/job-system';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { HistoryView } from './jobs/history/history-view';
import { SettingsView } from './jobs/settings/settings-view';
import { ThreadsView } from './jobs/threads/threads-view';
const VIEWS = [
    { value: 'threads', label: 'Threads' },
    { value: 'history', label: 'Histórico' },
    { value: 'settings', label: 'Configuração' },
] as const;
type JobsView = (typeof VIEWS)[number]['value'];
type JobsViewBodyProps = {
    view: JobsView;
    monitor: JobMonitor;
    benchmark: JobBenchmarkControl;
};
function JobsViewBody({ view, monitor, benchmark }: JobsViewBodyProps) {
    switch (view) {
        case 'threads':
            return <ThreadsView monitor={monitor} benchmark={benchmark}/>;
        case 'history':
            return <HistoryView history={monitor.snapshot.history}/>;
        case 'settings':
            return <SettingsView snapshot={monitor.snapshot} benchmark={benchmark}/>;
    }
}
function summarize(snapshot: JobSystemSnapshot): Array<string | false> {
    const { totals } = snapshot;
    const failures = totals.failed + totals.timedOut;
    return [
        snapshot.mode === 'threads' ? plural(snapshot.threadCount, 'thread', 'threads') : 'thread principal',
        snapshot.sharedMemory ? 'memória compartilhada' : 'memória copiada',
        `${snapshot.queued + snapshot.waiting} na fila`,
        `${snapshot.running} rodando`,
        plural(totals.completed, 'concluído', 'concluídos'),
        failures > 0 && plural(failures, 'falha', 'falhas'),
        totals.cancelled > 0 && plural(totals.cancelled, 'cancelado', 'cancelados'),
    ];
}
export function JobsPanel() {
    const session = useSessionTopic('scene', 'playtest');
    const [view, setView] = useState<JobsView>('threads');
    const monitor = useJobMonitor(session);
    const benchmark = useJobBenchmark(session);
    const { snapshot } = monitor;
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <span className="flex min-w-0 max-w-md flex-1">
          <SegmentedControl label="Seção do sistema de jobs" options={VIEWS} value={view} onChange={setView}/>
        </span>
        <IconButton label="Limpar histórico e contadores" size="sm" className="ml-auto" disabled={snapshot.totals.scheduled === 0} onClick={() => session.scripts.jobs.clearHistory()}>
          <Eraser />
        </IconButton>
      </PanelToolbar>
      <div className="min-h-0 flex-1 overflow-auto">
        <JobsViewBody view={view} monitor={monitor} benchmark={benchmark}/>
      </div>
      <PanelSummaryFooter parts={summarize(snapshot)}/>
    </div>);
}
