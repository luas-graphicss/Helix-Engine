import type { PollResponse, ToolCallEvent, ToolCallResult } from '@/engine/mcp/protocol/bridge-messages';
import type { WorkerSettings } from '@/engine/mcp/worker/runtime/worker-settings';
import { callTimedOut, engineDisconnected, queueExpired, queueFull, type CallFailure } from './call-failure';
import type { SessionStats } from './session-stats';
const DELIVERY_MARGIN_MS = 1500;
const DELIVERY_BATCH_SIZE = 8;
export type CallOutcome = {
    readonly status: 'completed';
    readonly result: ToolCallResult;
} | {
    readonly status: 'failed';
    readonly failure: CallFailure;
};
export interface CallRequest {
    readonly tool: string;
    readonly arguments: Readonly<Record<string, unknown>>;
    readonly agent: string;
}
interface PendingCall {
    readonly callId: string;
    readonly request: CallRequest;
    readonly expiresAt: number;
    readonly timer: ReturnType<typeof setTimeout>;
    readonly settle: (outcome: CallOutcome) => void;
    delivered: boolean;
}
export class CallQueue {
    private readonly pending = new Map<string, PendingCall>();
    constructor(private readonly settings: WorkerSettings, private readonly stats: SessionStats, private readonly onWork: () => void) { }
    get waitingCount(): number {
        return this.count(false);
    }
    get runningCount(): number {
        return this.count(true);
    }
    submit(request: CallRequest): Promise<CallOutcome> {
        const { queueLimit, callTimeoutMs } = this.settings;
        if (this.pending.size >= queueLimit) {
            this.stats.refused++;
            return Promise.resolve({ status: 'failed', failure: queueFull(queueLimit) });
        }
        const callId = crypto.randomUUID();
        const outcome = new Promise<CallOutcome>((settle) => {
            const timer = setTimeout(() => this.expire(callId), callTimeoutMs);
            this.pending.set(callId, { callId, request, expiresAt: Date.now() + callTimeoutMs, timer, settle, delivered: false });
        });
        this.stats.submitted++;
        this.onWork();
        return outcome;
    }
    takeBatch(): PollResponse {
        const calls: ToolCallEvent[] = [];
        const now = Date.now();
        for (const call of Array.from(this.pending.values())) {
            if (calls.length >= DELIVERY_BATCH_SIZE)
                break;
            if (call.delivered)
                continue;
            const remainingMs = call.expiresAt - now - DELIVERY_MARGIN_MS;
            if (remainingMs <= 0) {
                this.stats.expired++;
                this.finish(call, { status: 'failed', failure: queueExpired() });
                continue;
            }
            call.delivered = true;
            calls.push({ callId: call.callId, tool: call.request.tool, arguments: call.request.arguments, agent: call.request.agent, remainingMs });
        }
        return { calls };
    }
    settle(results: readonly ToolCallResult[]): number {
        let accepted = 0;
        for (const result of results) {
            const call = this.pending.get(result.callId);
            if (!call?.delivered)
                continue;
            if (result.failed)
                this.stats.failed++;
            else
                this.stats.completed++;
            this.finish(call, { status: 'completed', result });
            accepted++;
        }
        return accepted;
    }
    abandonDelivered(): void {
        for (const call of Array.from(this.pending.values())) {
            if (call.delivered)
                this.fail(call, engineDisconnected(true));
        }
    }
    abandonAll(): void {
        for (const call of Array.from(this.pending.values()))
            this.fail(call, engineDisconnected(call.delivered));
    }
    private count(delivered: boolean): number {
        let total = 0;
        for (const call of this.pending.values()) {
            if (call.delivered === delivered)
                total++;
        }
        return total;
    }
    private expire(callId: string): void {
        const call = this.pending.get(callId);
        if (!call)
            return;
        this.stats.expired++;
        this.finish(call, { status: 'failed', failure: call.delivered ? callTimedOut(this.settings.callTimeoutMs) : queueExpired() });
    }
    private fail(call: PendingCall, failure: CallFailure): void {
        this.stats.failed++;
        this.finish(call, { status: 'failed', failure });
    }
    private finish(call: PendingCall, outcome: CallOutcome): void {
        clearTimeout(call.timer);
        this.pending.delete(call.callId);
        call.settle(outcome);
    }
}
