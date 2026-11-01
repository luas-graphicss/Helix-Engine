import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { LogLevel } from '@/engine/editor/session/editor-log';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { clearBatchCheckpoint, readBatchCheckpoint, writeBatchCheckpoint, type BatchCheckpoint, type PassInProgress } from './batch-checkpoint';
import { countLevel, describeResult, describeSummary, formatBatchReport, formatDuration, formatLanguageReport, hasBrokenPasses, isReportable, summarizeResults } from './batch-report';
import { BATCH_STEP_LABEL, settleProfile, type BatchProgress, type BatchState, type BatchStep, type BatchTarget, type DebugBatchSteps, type LanguageTestResult, type LanguageTestStatus, type SettleProfileId, type StepOutcome } from './batch-types';
import { LogCapture } from './log-capture';
const LOG_SOURCE = 'Debug';
const COMPILE_TIMEOUT_MS = 180000;
const BREATHER_MS = 250;
const MAX_PASS_ATTEMPTS = 2;
const CHECKPOINT_DEBOUNCE_MS = 400;
class BatchCancelled extends Error {
    constructor() {
        super('Teste automático cancelado.');
        this.name = 'BatchCancelled';
    }
}
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new BatchCancelled());
            return;
        }
        const timer = window.setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            window.clearTimeout(timer);
            reject(new BatchCancelled());
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T, signal: AbortSignal): Promise<T> {
    return Promise.race([promise, delay(ms, signal).then(onTimeout)]);
}
export function targetLabel(target: BatchTarget): string {
    const label = scriptLanguage(target.language).label;
    return target.note ? `${label} · ${target.note}` : label;
}
interface BatchPlan {
    readonly targets: readonly BatchTarget[];
    readonly startedAt: number;
    readonly elapsedMs: number;
    readonly reloads: number;
    readonly results: readonly LanguageTestResult[];
    readonly index: number;
    readonly attempt: number;
    readonly interrupted: PassInProgress | null;
}
export class DebugBatchRunner {
    state: BatchState = 'idle';
    progress: BatchProgress | null = null;
    results: LanguageTestResult[] = [];
    report: string | null = null;
    settle: SettleProfileId = 'normal';
    startedAt: Date | null = null;
    durationMs = 0;
    reloads = 0;
    private abort: AbortController | null = null;
    private plan: BatchPlan | null = null;
    private resumedAt = 0;
    private current: PassInProgress | null = null;
    private passStartedAt = 0;
    private capture: LogCapture | null = null;
    private checkpointTimer = 0;
    private resumeChecked = false;
    constructor(private readonly session: EditorSession, private readonly steps: DebugBatchSteps) { }
    get isRunning(): boolean {
        return this.state === 'running';
    }
    setSettle(id: SettleProfileId): void {
        this.settle = id;
        this.session.notify();
    }
    cancel(): void {
        if (!this.isRunning || !this.abort)
            return;
        this.abort.abort();
        this.session.log.warn(LOG_SOURCE, 'Cancelando o teste automático: a passada atual termina e o relatório sai com o que já foi testado.');
    }
    async run(targets: readonly BatchTarget[]): Promise<void> {
        if (this.isRunning || targets.length === 0)
            return;
        this.session.log.info(LOG_SOURCE, `Teste automático em ${targets.length} ${targets.length === 1 ? 'passada' : 'passadas'}: ${targets.map(targetLabel).join(', ')}.`);
        await this.execute({ targets, startedAt: Date.now(), elapsedMs: 0, reloads: 0, results: [], index: 0, attempt: 1, interrupted: null });
    }
    async resumePending(): Promise<void> {
        if (this.resumeChecked || this.session.code.standalone)
            return;
        this.resumeChecked = true;
        const checkpoint = await readBatchCheckpoint(this.session.project.id);
        if (!checkpoint || this.state !== 'idle')
            return;
        this.state = 'running';
        this.steps.setBusy(true);
        this.session.notify();
        await this.whenViewportReady();
        const plan = this.planFrom(checkpoint);
        this.settle = checkpoint.settle;
        this.session.log.warn(LOG_SOURCE, this.describeResume(plan));
        await this.execute(plan);
    }
    private planFrom(checkpoint: BatchCheckpoint): BatchPlan {
        const { current, results } = checkpoint;
        return {
            targets: checkpoint.targets,
            startedAt: checkpoint.startedAt,
            elapsedMs: checkpoint.elapsedMs,
            reloads: checkpoint.reloads + 1,
            results,
            index: current ? current.index : results.length,
            attempt: current ? current.attempt + 1 : 1,
            interrupted: current,
        };
    }
    private describeResume(plan: BatchPlan): string {
        const done = plan.results.length;
        const target = plan.targets[plan.index];
        const where = target ? `${plan.index + 1}/${plan.targets.length} · ${targetLabel(target)}` : 'o relatório final';
        const retry = plan.interrupted ? (plan.attempt <= MAX_PASS_ATTEMPTS ? ` (tentativa ${plan.attempt}; a aba caiu em "${BATCH_STEP_LABEL[plan.interrupted.step]}")` : ' (dada como interrompida: a aba caiu nela de novo)') : '';
        const summary = done > 0 ? `${done} ${done === 1 ? 'passada já feita' : 'passadas já feitas'} (${describeSummary(summarizeResults(plan.results))})` : 'nenhuma passada concluída ainda';
        return `Teste automático retomado depois de a aba recarregar: ${summary}; continuando em ${where}${retry}.`;
    }
    private whenViewportReady(): Promise<void> {
        if (this.session.viewportReady)
            return Promise.resolve();
        return new Promise((resolve) => {
            const unsubscribe = this.session.subscribe(() => {
                if (!this.session.viewportReady)
                    return;
                unsubscribe();
                resolve();
            });
        });
    }
    private async execute(plan: BatchPlan): Promise<void> {
        const abort = new AbortController();
        this.abort = abort;
        this.plan = plan;
        this.resumedAt = performance.now();
        this.state = 'running';
        this.results = [...plan.results];
        this.report = null;
        this.progress = null;
        this.startedAt = new Date(plan.startedAt);
        this.durationMs = plan.elapsedMs;
        this.reloads = plan.reloads;
        this.steps.setBusy(true);
        this.session.notify();
        try {
            for (let index = plan.index; index < plan.targets.length; index++) {
                if (abort.signal.aborted)
                    break;
                const target = plan.targets[index];
                const first = index === plan.index;
                const attempt = first ? plan.attempt : 1;
                const interrupted = first ? plan.interrupted : null;
                const result = interrupted && attempt > MAX_PASS_ATTEMPTS ? this.giveUp(target, interrupted) : await this.runTarget(target, index, attempt, abort.signal);
                this.results = [...this.results, result];
                this.publish(result);
                await this.saveCheckpoint();
                if (result.status === 'cancelled')
                    break;
                try {
                    await delay(BREATHER_MS, abort.signal);
                }
                catch {
                    break;
                }
            }
        }
        finally {
            this.durationMs = this.elapsedMs();
            this.state = abort.signal.aborted ? 'cancelled' : 'done';
            this.progress = null;
            this.abort = null;
            this.plan = null;
            this.cancelScheduledCheckpoint();
            void clearBatchCheckpoint();
            this.steps.setBusy(false);
            this.finish();
        }
    }
    private elapsedMs(): number {
        return (this.plan?.elapsedMs ?? 0) + (performance.now() - this.resumedAt);
    }
    private setStep(target: BatchTarget, index: number, step: BatchStep): void {
        const total = this.plan?.targets.length ?? 0;
        this.progress = { target, label: targetLabel(target), index: index + 1, total, step };
        if (this.current)
            this.current = { ...this.current, step };
        this.session.notify();
        void this.saveCheckpoint();
    }
    private async runTarget(target: BatchTarget, index: number, attempt: number, signal: AbortSignal): Promise<LanguageTestResult> {
        const label = targetLabel(target);
        const total = this.plan?.targets.length ?? 0;
        const capture = new LogCapture(this.session.log, () => this.scheduleCheckpoint());
        this.capture = capture;
        this.passStartedAt = performance.now();
        this.current = { index, attempt, step: 'install', compileMessage: '', runtimeMessage: '', entries: [], elapsedMs: 0 };
        let status: LanguageTestStatus | 'ran' = 'ran';
        let compileMessage = '';
        let runtimeMessage = '';
        this.session.log.info(LOG_SOURCE, `▶ ${label} (${index + 1}/${total})${attempt > 1 ? ` · tentativa ${attempt}` : ''}`);
        capture.start();
        try {
            this.setStep(target, index, 'install');
            await this.steps.install(target);
            if (signal.aborted)
                throw new BatchCancelled();
            this.setStep(target, index, 'compile');
            const compiled = await withTimeout(this.steps.compile(), COMPILE_TIMEOUT_MS, (): StepOutcome => ({ ok: false, message: `a compilação não terminou em ${formatDuration(COMPILE_TIMEOUT_MS)}.` }), signal);
            compileMessage = compiled.message;
            if (this.current)
                this.current = { ...this.current, compileMessage };
            if (!compiled.ok)
                status = 'compile-failed';
            else {
                if (signal.aborted)
                    throw new BatchCancelled();
                this.setStep(target, index, 'play');
                const played = await this.steps.play();
                runtimeMessage = played.message;
                if (this.current)
                    this.current = { ...this.current, runtimeMessage };
                if (!played.ok)
                    status = 'runtime-failed';
                else {
                    this.setStep(target, index, 'settle');
                    await this.settleDown(capture, signal);
                }
            }
        }
        catch (cause) {
            if (cause instanceof BatchCancelled)
                status = 'cancelled';
            else {
                status = 'install-failed';
                runtimeMessage = describeError(cause);
            }
        }
        finally {
            this.steps.stop();
            this.cancelScheduledCheckpoint();
            this.capture = null;
            this.current = null;
        }
        const entries = capture.stop().filter(isReportable);
        const errors = countLevel(entries, 'error');
        const warnings = countLevel(entries, 'warn');
        return {
            target,
            label,
            status: status === 'ran' ? (errors + warnings > 0 ? 'issues' : 'passed') : status,
            compileMessage,
            runtimeMessage,
            entries,
            errors,
            warnings,
            durationMs: performance.now() - this.passStartedAt,
            reloads: attempt - 1,
        };
    }
    private giveUp(target: BatchTarget, interrupted: PassInProgress): LanguageTestResult {
        const { entries } = interrupted;
        return {
            target,
            label: targetLabel(target),
            status: 'interrupted',
            compileMessage: interrupted.compileMessage,
            runtimeMessage: `A aba recarregou ${interrupted.attempt} vezes no meio desta passada, a última em "${BATCH_STEP_LABEL[interrupted.step]}"; o lote seguiu sem tentá-la de novo. Abaixo, o que ela disse até cair.`,
            entries,
            errors: countLevel(entries, 'error'),
            warnings: countLevel(entries, 'warn'),
            durationMs: interrupted.elapsedMs,
            reloads: interrupted.attempt,
        };
    }
    private async settleDown(capture: LogCapture, signal: AbortSignal): Promise<void> {
        const profile = settleProfile(this.settle);
        const startedAt = performance.now();
        await delay(profile.minMs, signal);
        while (performance.now() - startedAt < profile.maxMs) {
            if (!this.session.playtest.isRunning)
                return;
            if (capture.quietForMs >= profile.quietMs)
                return;
            await delay(250, signal);
        }
    }
    private scheduleCheckpoint(): void {
        if (this.checkpointTimer !== 0)
            return;
        this.checkpointTimer = window.setTimeout(() => {
            this.checkpointTimer = 0;
            void this.saveCheckpoint();
        }, CHECKPOINT_DEBOUNCE_MS);
    }
    private cancelScheduledCheckpoint(): void {
        if (this.checkpointTimer === 0)
            return;
        window.clearTimeout(this.checkpointTimer);
        this.checkpointTimer = 0;
    }
    private saveCheckpoint(): Promise<void> {
        this.cancelScheduledCheckpoint();
        const { plan } = this;
        if (!plan)
            return Promise.resolve();
        const current = this.current ? { ...this.current, entries: this.capture?.peek().filter(isReportable) ?? this.current.entries, elapsedMs: performance.now() - this.passStartedAt } : null;
        return writeBatchCheckpoint(this.session.project.id, {
            targets: plan.targets,
            settle: this.settle,
            startedAt: plan.startedAt,
            elapsedMs: this.elapsedMs(),
            reloads: plan.reloads,
            results: this.results,
            current,
        });
    }
    private publish(result: LanguageTestResult): void {
        const level: LogLevel = result.status === 'passed' ? 'info' : result.status === 'issues' && result.errors === 0 ? 'warn' : result.status === 'cancelled' ? 'warn' : 'error';
        this.session.log[level](LOG_SOURCE, `${result.label}: ${describeResult(result)}`, { details: formatLanguageReport(result) });
    }
    private finish(): void {
        const cancelled = this.state === 'cancelled';
        const summary = summarizeResults(this.results);
        this.report = formatBatchReport(this.results, { startedAt: this.startedAt ?? new Date(), durationMs: this.durationMs, cancelled, reloads: this.reloads });
        const level: LogLevel = summary.errors > 0 || hasBrokenPasses(summary) ? 'error' : summary.warnings > 0 ? 'warn' : 'info';
        this.session.log[level](LOG_SOURCE, `Teste automático ${cancelled ? 'cancelado' : 'concluído'} em ${formatDuration(this.durationMs)}: ${describeSummary(summary)}. O relatório completo está nos detalhes desta entrada e no botão Copiar relatório da janela do modo debug.`, { details: this.report });
        this.session.notify();
    }
}
