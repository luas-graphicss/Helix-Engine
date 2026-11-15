import { createPeerId } from '@/engine/editor/mcp/settings/session-credentials';
import type { FileTransfer } from '@/engine/editor/mcp/tools/file-transfer';
import { BRIDGE_PROTOCOL_VERSION, type EngineIdentity, type ToolCallEvent, type ToolCallResult } from '@/engine/mcp/protocol/bridge-messages';
import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import { delay } from './abortable-delay';
import { BridgeClient, type BridgeTarget } from './bridge-client';
import { BridgeError, describeBridgeFailure } from './bridge-error';
import { BridgeFileTransfer } from './bridge-file-transfer';
import type { ConnectionStatus } from './connection-status';
import { ReconnectBackoff } from './reconnect-backoff';
const OUTBOX_LIMIT = 32;
export interface ConnectionHost {
    readonly tools: readonly ToolDescriptor[];
    readonly accessMode: string;
    describeEngine(): EngineIdentity;
    execute(call: ToolCallEvent, files: FileTransfer): Promise<ToolCallResult>;
    report(status: ConnectionStatus): void;
}
interface Link {
    readonly client: BridgeClient;
    readonly peer: string;
    readonly outbox: ToolCallResult[];
    readonly backoff: ReconnectBackoff;
    readonly signal: AbortSignal;
}
export class BridgeConnection {
    private running: AbortController | null = null;
    constructor(private readonly host: ConnectionHost) { }
    start(target: BridgeTarget): void {
        this.stop();
        const running = new AbortController();
        this.running = running;
        void this.run({ client: new BridgeClient(target), peer: createPeerId(), outbox: [], backoff: new ReconnectBackoff(), signal: running.signal });
    }
    stop(): void {
        if (!this.running)
            return;
        this.running.abort();
        this.running = null;
        this.host.report({ state: 'off' });
    }
    private async run(link: Link): Promise<void> {
        const { signal } = link;
        signal.addEventListener('abort', () => link.client.sayBye(link.peer), { once: true });
        this.host.report({ state: 'connecting' });
        while (!signal.aborted) {
            try {
                await this.serve(link);
            }
            catch (cause) {
                if (signal.aborted)
                    return;
                const reason = describeBridgeFailure(cause);
                if (cause instanceof BridgeError && cause.fatal) {
                    this.running = null;
                    this.host.report({ state: 'failed', reason });
                    return;
                }
                this.host.report({ state: 'reconnecting', reason });
                await delay(link.backoff.nextDelayMs(), signal);
            }
        }
    }
    private async serve(link: Link): Promise<void> {
        const { client, peer, outbox, signal } = link;
        const { tools } = this.host;
        const { pollWaitMs } = await client.hello({ protocol: BRIDGE_PROTOCOL_VERSION, peer, engine: this.host.describeEngine(), accessMode: this.host.accessMode, tools }, signal);
        link.backoff.reset();
        this.host.report({ state: 'online', toolCount: tools.length });
        const files = new BridgeFileTransfer(client, signal);
        while (!signal.aborted) {
            const flushed = outbox.slice();
            const { calls } = await client.poll({ peer, results: flushed }, pollWaitMs, signal);
            outbox.splice(0, flushed.length);
            const receivedAt = performance.now();
            for (const call of calls) {
                const remainingMs = call.remainingMs - (performance.now() - receivedAt);
                if (remainingMs <= 0)
                    continue;
                const result = await this.host.execute({ ...call, remainingMs }, files);
                if (signal.aborted)
                    return;
                await this.deliver(link, result);
            }
        }
    }
    private async deliver(link: Link, result: ToolCallResult): Promise<void> {
        try {
            await link.client.sendResults({ peer: link.peer, results: [result] }, link.signal);
        }
        catch (cause) {
            if (link.signal.aborted || !(cause instanceof BridgeError))
                throw cause;
            link.outbox.push(result);
            link.outbox.splice(0, Math.max(0, link.outbox.length - OUTBOX_LIMIT));
        }
    }
}
