import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { Scene } from '@/engine/core/scene/scene';
import { History } from '@/engine/editor/history/history';
import { createJobMonitor, type JobMonitor } from '@/engine/editor/jobs/job-load';
import type { JobBenchmarkControl, JobBenchmarkState } from '@/engine/editor/jobs/use-job-benchmark';
import { JobsPanel } from '@/engine/editor/panels/jobs-panel';
import { HistoryView } from '@/engine/editor/panels/jobs/history/history-view';
import { SettingsView } from '@/engine/editor/panels/jobs/settings/settings-view';
import { ThreadsView } from '@/engine/editor/panels/jobs/threads/threads-view';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { EditorSessionProvider } from '@/engine/editor/session/editor-session-context';
import type { JobSystem } from '@/engine/jobs/system/job-system';
import { createTestJobSystem } from '../../jobs/job-test-system';
export interface JobsPanelStage {
    readonly scene: Scene;
    readonly history: History;
    readonly jobs: JobSystem;
    readonly session: EditorSession;
    readonly logged: string[];
}
export function benchmarkIn(state: JobBenchmarkState): JobBenchmarkControl {
    return { state, run: () => undefined };
}
const IDLE_BENCHMARK = benchmarkIn({ status: 'idle' });
export function createJobsPanelStage(threads: number): JobsPanelStage {
    const scene = new Scene();
    const history = new History(() => undefined);
    const jobs = createTestJobSystem(threads);
    const logged: string[] = [];
    const stub = {
        scene,
        history,
        scripts: { running: false, mode: 'play', jobs },
        log: { info: (_source: string, message: string) => logged.push(message) },
        notify: () => undefined,
        subscribeTopic: () => () => undefined,
        getTopicVersion: () => 0,
    };
    return { scene, history, jobs, session: stub as unknown as EditorSession, logged };
}
function render(stage: JobsPanelStage, node: ReactNode): string {
    return renderToStaticMarkup(<EditorSessionProvider session={stage.session}>{node}</EditorSessionProvider>);
}
export function renderPanel(stage: JobsPanelStage): string {
    return render(stage, <JobsPanel />);
}
export function renderThreads(stage: JobsPanelStage, monitor: JobMonitor = createJobMonitor(stage.jobs.snapshot())): string {
    return render(stage, <ThreadsView monitor={monitor} benchmark={IDLE_BENCHMARK}/>);
}
export function renderHistory(stage: JobsPanelStage): string {
    return render(stage, <HistoryView history={stage.jobs.snapshot().history}/>);
}
export function renderSettings(stage: JobsPanelStage, benchmark: JobBenchmarkControl = IDLE_BENCHMARK): string {
    return render(stage, <SettingsView snapshot={stage.jobs.snapshot()} benchmark={benchmark}/>);
}
