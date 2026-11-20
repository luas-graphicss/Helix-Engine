'use client';
import { useState } from 'react';
import { runJobBenchmark } from '@/engine/editor/operations/jobs/job-benchmark-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { JobBenchmarkResult } from './job-benchmark';
export type JobBenchmarkState = {
    readonly status: 'idle' | 'running';
} | {
    readonly status: 'done';
    readonly result: JobBenchmarkResult;
} | {
    readonly status: 'failed';
    readonly message: string;
};
export interface JobBenchmarkControl {
    readonly state: JobBenchmarkState;
    run(): void;
}
export function useJobBenchmark(session: EditorSession): JobBenchmarkControl {
    const [state, setState] = useState<JobBenchmarkState>({ status: 'idle' });
    const measure = async (): Promise<void> => {
        setState({ status: 'running' });
        try {
            setState({ status: 'done', result: await runJobBenchmark(session) });
        }
        catch (cause) {
            setState({ status: 'failed', message: cause instanceof Error ? cause.message : String(cause) });
        }
    };
    return {
        state,
        run: () => {
            if (state.status !== 'running')
                void measure();
        },
    };
}
