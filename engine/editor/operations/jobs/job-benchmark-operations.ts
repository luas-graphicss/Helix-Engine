import { plural } from '@/engine/core/format/format-time';
import { measureJobSpeedup, type JobBenchmarkResult } from '@/engine/editor/jobs/job-benchmark';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Jobs';
function describeResult(result: JobBenchmarkResult): string {
    const speedup = result.speedup.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `Medição de jobs: ${Math.round(result.singleMs)} ms com 1 thread, ${Math.round(result.parallelMs)} ms com ${plural(result.threads, 'thread', 'threads')}, ganho de ${speedup}×.`;
}
export async function runJobBenchmark(session: EditorSession): Promise<JobBenchmarkResult> {
    const { scripts } = session;
    if (!scripts.running)
        scripts.jobs.configure(session.scene.jobs);
    try {
        const result = await measureJobSpeedup(scripts.jobs);
        session.log.info(LOG_SOURCE, describeResult(result));
        return result;
    }
    finally {
        if (!scripts.running)
            scripts.jobs.releaseThreads();
    }
}
