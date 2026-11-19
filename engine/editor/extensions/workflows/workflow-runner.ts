import type { WorkflowContribution, WorkflowStepControl } from './workflow-contribution';
export type WorkflowOutcome = 'done' | 'failed' | 'cancelled';
export interface WorkflowProgress {
    readonly workflowId: string;
    readonly title: string;
    readonly stepIndex: number;
    readonly stepCount: number;
    readonly stepTitle: string;
    readonly fraction: number;
    readonly message: string | null;
    readonly cancelling: boolean;
}
export interface WorkflowResult {
    readonly outcome: WorkflowOutcome;
    readonly finishedAt: number;
    readonly durationMs: number;
}
export interface WorkflowReporter {
    started(workflow: WorkflowContribution): void;
    finished(workflow: WorkflowContribution, result: WorkflowResult): void;
}
interface Run {
    readonly workflow: WorkflowContribution;
    readonly outcome: Promise<WorkflowOutcome>;
    readonly settle: (outcome: WorkflowOutcome) => void;
    cancelled: boolean;
    stepIndex: number;
    stepFraction: number;
    message: string | null;
}
type Listener = () => void;
const MAX_QUEUED_RUNS = 16;
function createRun(workflow: WorkflowContribution): Run {
    let settle: (outcome: WorkflowOutcome) => void = () => undefined;
    const outcome = new Promise<WorkflowOutcome>((resolve) => {
        settle = resolve;
    });
    return { workflow, outcome, settle, cancelled: false, stepIndex: 0, stepFraction: 0, message: null };
}
function clampFraction(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
export class WorkflowRunner {
    private readonly queue: Run[] = [];
    private readonly results = new Map<string, WorkflowResult>();
    private readonly listeners = new Set<Listener>();
    private current: Run | null = null;
    private snapshot: WorkflowProgress | null = null;
    private version = 0;
    constructor(private readonly reporter: WorkflowReporter, private readonly now: () => number = () => Date.now()) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    get progress(): WorkflowProgress | null {
        return this.snapshot;
    }
    resultOf(workflowId: string): WorkflowResult | null {
        return this.results.get(workflowId) ?? null;
    }
    isPending(workflowId: string): boolean {
        return this.current?.workflow.id === workflowId || this.queue.some((run) => run.workflow.id === workflowId);
    }
    run(workflow: WorkflowContribution): Promise<WorkflowOutcome> {
        const queued = this.queue.find((run) => run.workflow.id === workflow.id);
        if (queued)
            return queued.outcome;
        if (this.queue.length >= MAX_QUEUED_RUNS)
            return Promise.resolve('cancelled');
        const run = createRun(workflow);
        this.queue.push(run);
        this.changed();
        void this.drain();
        return run.outcome;
    }
    cancel(workflowId: string | null = null): void {
        const matches = (run: Run): boolean => workflowId === null || run.workflow.id === workflowId;
        for (let index = this.queue.length - 1; index >= 0; index--) {
            if (!matches(this.queue[index]))
                continue;
            const [run] = this.queue.splice(index, 1);
            run.settle('cancelled');
        }
        if (this.current && matches(this.current))
            this.current.cancelled = true;
        this.changed();
    }
    private async drain(): Promise<void> {
        if (this.current)
            return;
        for (let run = this.queue.shift(); run; run = this.queue.shift()) {
            this.current = run;
            const outcome = await this.execute(run);
            this.current = null;
            this.changed();
            run.settle(outcome);
        }
    }
    private async execute(run: Run): Promise<WorkflowOutcome> {
        const { workflow } = run;
        const startedAt = this.now();
        const control: WorkflowStepControl = {
            get cancelled() {
                return run.cancelled;
            },
            report: (fraction, message) => {
                run.stepFraction = clampFraction(fraction);
                run.message = message;
                this.changed();
            },
        };
        this.reporter.started(workflow);
        let outcome: WorkflowOutcome = 'done';
        for (let index = 0; index < workflow.steps.length; index++) {
            if (run.cancelled) {
                outcome = 'cancelled';
                break;
            }
            run.stepIndex = index;
            run.stepFraction = 0;
            run.message = null;
            this.changed();
            try {
                await workflow.steps[index].run(control);
            }
            catch {
                outcome = 'failed';
                break;
            }
        }
        const finishedAt = this.now();
        const result: WorkflowResult = { outcome, finishedAt, durationMs: finishedAt - startedAt };
        this.results.set(workflow.id, result);
        this.reporter.finished(workflow, result);
        return outcome;
    }
    private changed(): void {
        this.snapshot = this.current ? this.describe(this.current) : null;
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    private describe(run: Run): WorkflowProgress {
        const { steps } = run.workflow;
        return {
            workflowId: run.workflow.id,
            title: run.workflow.title,
            stepIndex: run.stepIndex,
            stepCount: steps.length,
            stepTitle: steps[run.stepIndex]?.title ?? '',
            fraction: steps.length === 0 ? 1 : (run.stepIndex + run.stepFraction) / steps.length,
            message: run.message,
            cancelling: run.cancelled,
        };
    }
}
