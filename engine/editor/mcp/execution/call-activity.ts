import type { ToolCallEvent } from '@/engine/mcp/protocol/bridge-messages';
const HISTORY_LIMIT = 30;
type Listener = () => void;
export type CallState = 'running' | 'done' | 'failed';
export interface CallRecord {
    readonly callId: string;
    readonly title: string;
    readonly agent: string;
    readonly state: CallState;
    readonly durationMs: number | null;
}
export class CallActivity {
    private records: readonly CallRecord[] = [];
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): readonly CallRecord[] => this.records;
    begin(call: ToolCallEvent, title: string): void {
        const record: CallRecord = { callId: call.callId, title, agent: call.agent, state: 'running', durationMs: null };
        this.publish([record, ...this.records].slice(0, HISTORY_LIMIT));
    }
    finish(callId: string, failed: boolean, durationMs: number): void {
        this.publish(this.records.map((record) => (record.callId === callId ? { ...record, state: failed ? 'failed' : 'done', durationMs } : record)));
    }
    private publish(records: readonly CallRecord[]): void {
        this.records = records;
        for (const listener of this.listeners)
            listener();
    }
}
