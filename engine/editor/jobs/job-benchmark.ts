import { plural } from '@/engine/core/format/format-time';
import type { JobSystem } from '@/engine/jobs/system/job-system';
export interface JobBenchmarkResult {
    readonly threads: number;
    readonly singleMs: number;
    readonly parallelMs: number;
    readonly speedup: number;
}
const FIELD_WIDTH = 1024;
const FIELD_SAMPLES = FIELD_WIDTH * FIELD_WIDTH;
const FIELD_INPUT = { width: FIELD_WIDTH, scale: 0.01, octaves: 5 };
const BENCHMARK_TIMEOUT_MS = 60000;
const NOISE_FIELD = `(input, job) => {
    const { fbm } = job.math.noise;
    for (let sample = job.start; sample < job.end; sample++) {
        const x = (sample % input.width) * input.scale;
        const z = Math.floor(sample / input.width) * input.scale;
        job.output[sample - job.start] = fbm(x, 0, z, input.octaves);
    }
}`;
async function elapsedMs(work: () => PromiseLike<unknown>): Promise<number> {
    const startedAt = performance.now();
    await work();
    return performance.now() - startedAt;
}
export async function measureJobSpeedup(jobs: JobSystem): Promise<JobBenchmarkResult> {
    const program = jobs.program(NOISE_FIELD);
    const threads = jobs.threadCount;
    const field = jobs.createBuffer('float32', FIELD_SAMPLES);
    const shared = { timeoutMs: BENCHMARK_TIMEOUT_MS, output: field };
    await jobs.parallelFor(threads, program, FIELD_INPUT, { ...shared, name: 'medição · aquecimento', batchSize: 1 });
    const singleMs = await elapsedMs(() => jobs.parallelFor(FIELD_SAMPLES, program, FIELD_INPUT, { ...shared, name: 'medição · 1 thread', batchSize: FIELD_SAMPLES }));
    const parallelMs = await elapsedMs(() => jobs.parallelFor(FIELD_SAMPLES, program, FIELD_INPUT, { ...shared, name: `medição · ${plural(threads, 'thread', 'threads')}` }));
    return { threads, singleMs, parallelMs, speedup: singleMs / parallelMs };
}
