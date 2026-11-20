'use client';
import { plural } from '@/engine/core/format/format-time';
import type { JobBenchmarkControl } from '@/engine/editor/jobs/use-job-benchmark';
import { updateJobSettings } from '@/engine/editor/operations/jobs/job-settings-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { AUTOMATIC_THREADS, MAX_JOB_THREADS, MAX_JOB_TIMEOUT_SECONDS, QUEUE_LIMITS, automaticThreadCount } from '@/engine/jobs/settings/job-settings';
import type { JobSystemSnapshot } from '@/engine/jobs/system/job-system';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { Readout } from '../shared/readout';
import { BenchmarkSection } from './benchmark-section';
const QUEUE_OPTIONS = QUEUE_LIMITS.map((limit) => ({ value: limit, label: limit.toLocaleString('pt-BR') }));
const COLUMN_CLASS = 'min-w-0 border-border @3xl/panel:border-r';
const THREADS_HINT = 'Desligado, os jobs rodam na thread principal, um por vez. Serve para depurar um job passo a passo.';
const QUEUE_HINT = 'Quantos jobs podem estar em andamento ao mesmo tempo antes de novos serem recusados.';
const SHARED_MEMORY_HINT = 'Com memória compartilhada, as threads leem e escrevem os arrays de helix.jobs.createBuffer sem copiar.';
const formatTimeout = (seconds: number): string => (seconds === 0 ? 'Sem limite' : `${seconds} s`);
type SettingsViewProps = {
    snapshot: JobSystemSnapshot;
    benchmark: JobBenchmarkControl;
};
export function SettingsView({ snapshot, benchmark }: SettingsViewProps) {
    const session = useEditorSession();
    const settings = session.scene.jobs;
    const automatic = automaticThreadCount(snapshot.logicalCores);
    const mostThreads = Math.min(MAX_JOB_THREADS, Math.max(snapshot.logicalCores, settings.threads));
    const formatThreads = (count: number): string => (count === AUTOMATIC_THREADS ? `Auto · ${automatic}` : String(count));
    return (<div className="grid auto-rows-min grid-cols-1 @3xl/panel:grid-cols-3">
      <div className={COLUMN_CLASS}>
        <CollapsibleSection title="Threads">
          <ToggleField label="Usar threads" hint={THREADS_HINT} on={settings.enabled} onToggle={() => updateJobSettings(session, { enabled: !settings.enabled })}/>
          <SliderField label="Quantidade" value={settings.threads} min={AUTOMATIC_THREADS} max={mostThreads} step={1} disabled={!settings.enabled} format={formatThreads} onChange={(threads) => updateJobSettings(session, { threads })}/>
          <SliderField label="Tempo limite" value={settings.timeoutSeconds} min={0} max={MAX_JOB_TIMEOUT_SECONDS} step={1} format={formatTimeout} onChange={(timeoutSeconds) => updateJobSettings(session, { timeoutSeconds })}/>
          <PropertyRow label="Fila máxima" hint={QUEUE_HINT}>
            <SegmentedControl label="Tamanho máximo da fila de jobs" options={QUEUE_OPTIONS} value={settings.maxQueued} onChange={(maxQueued) => updateJobSettings(session, { maxQueued })}/>
          </PropertyRow>
        </CollapsibleSection>
      </div>
      <div className={COLUMN_CLASS}>
        <CollapsibleSection title="Dispositivo">
          <PropertyRow label="Núcleos">
            <Readout>{snapshot.logicalCores}</Readout>
          </PropertyRow>
          <PropertyRow label="Em uso">
            <Readout>{snapshot.mode === 'threads' ? plural(snapshot.threadCount, 'thread', 'threads') : 'thread principal'}</Readout>
          </PropertyRow>
          <PropertyRow label="Memória" hint={SHARED_MEMORY_HINT}>
            <Readout>{snapshot.sharedMemory ? 'compartilhada' : 'copiada por job'}</Readout>
          </PropertyRow>
        </CollapsibleSection>
      </div>
      <div className="min-w-0">
        <BenchmarkSection benchmark={benchmark}/>
      </div>
    </div>);
}
