'use client';
import { Timer } from 'lucide-react';
import { plural } from '@/engine/core/format/format-time';
import type { JobBenchmarkControl } from '@/engine/editor/jobs/use-job-benchmark';
import { ActionButton } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { formatMilliseconds, formatSpeedup } from '../shared/job-format';
import { Readout } from '../shared/readout';
export function BenchmarkSection({ benchmark }: {
    benchmark: JobBenchmarkControl;
}) {
    const { state } = benchmark;
    const measuring = state.status === 'running';
    return (<CollapsibleSection title="Medição">
      <p className="px-2 pb-1 text-3xs leading-relaxed text-pretty text-muted-foreground">
        Calcula um campo de ruído com uma thread e depois com todas, e compara os tempos.
      </p>
      <div className="flex px-2 py-1">
        <ActionButton variant="primary" icon={Timer} disabled={measuring} onClick={benchmark.run}>
          {measuring ? 'Medindo…' : 'Medir ganho'}
        </ActionButton>
      </div>
      {state.status === 'done' && (<>
          <PropertyRow label="1 thread">
            <Readout>{formatMilliseconds(state.result.singleMs)}</Readout>
          </PropertyRow>
          <PropertyRow label={plural(state.result.threads, 'thread', 'threads')}>
            <Readout>{formatMilliseconds(state.result.parallelMs)}</Readout>
          </PropertyRow>
          <PropertyRow label="Ganho">
            <Readout>{formatSpeedup(state.result.speedup)}</Readout>
          </PropertyRow>
        </>)}
      {state.status === 'failed' && (<p role="alert" className="px-2 py-1 text-2xs leading-relaxed text-pretty text-destructive">
          Não foi possível medir. {state.message}
        </p>)}
    </CollapsibleSection>);
}
