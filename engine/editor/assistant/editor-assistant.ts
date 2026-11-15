import { readPreference, writePreference } from '@/engine/core/storage/preferences';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { runAgent } from './agent/agent-loop';
import type { ToolExecutionHost } from './agent/tool-execution';
import { ConversationStore } from './conversation/conversation-store';
import { DEFAULT_MODE_ID, findAssistantMode, isAssistantModeId, type AssistantMode, type AssistantModeId } from './modes/assistant-mode';
import { connectionProblem } from './providers/connection-settings';
import { ConnectionStore } from './providers/connection-store';
import { ProviderError } from './providers/provider-http';
const MODE_PREFERENCE_KEY = 'assistant-mode';
type Listener = () => void;
function describeFailure(cause: unknown): string {
    if (cause instanceof ProviderError)
        return cause.message;
    return `O assistente parou por uma falha inesperada: ${cause instanceof Error ? cause.message : String(cause)}`;
}
export class EditorAssistant implements ToolExecutionHost {
    readonly connection = new ConnectionStore();
    readonly conversation = new ConversationStore();
    private modeId: AssistantModeId = DEFAULT_MODE_ID;
    private modeChosen = false;
    private run: AbortController | null = null;
    private resetRequested = false;
    private readonly approvals = new Map<number, (approved: boolean) => void>();
    private readonly modeListeners = new Set<Listener>();
    constructor(readonly session: EditorSession) { }
    readonly subscribeMode = (listener: Listener): (() => void) => {
        this.modeListeners.add(listener);
        return () => this.modeListeners.delete(listener);
    };
    readonly getModeId = (): AssistantModeId => this.modeId;
    get mode(): AssistantMode {
        return findAssistantMode(this.modeId);
    }
    async load(): Promise<void> {
        const [storedMode] = await Promise.all([readPreference<unknown>(MODE_PREFERENCE_KEY), this.connection.load()]);
        if (!this.modeChosen && isAssistantModeId(storedMode))
            this.applyMode(storedMode);
    }
    setMode(modeId: AssistantModeId): void {
        this.modeChosen = true;
        if (modeId === this.modeId)
            return;
        this.applyMode(modeId);
        void writePreference(MODE_PREFERENCE_KEY, modeId);
    }
    send(text: string): void {
        const prompt = text.trim();
        if (!prompt || this.run)
            return;
        const problem = connectionProblem(this.connection.getSnapshot());
        if (problem) {
            this.conversation.addNotice('error', problem);
            return;
        }
        this.conversation.addUserMessage(prompt);
        void this.respond();
    }
    stop(): void {
        this.run?.abort();
        for (const [entryId, settle] of this.approvals) {
            this.approvals.delete(entryId);
            settle(false);
        }
    }
    reset(): void {
        this.stop();
        if (this.run)
            this.resetRequested = true;
        else
            this.conversation.clear();
    }
    confirm(entryId: number, signal: AbortSignal): Promise<boolean> {
        return new Promise((resolve) => {
            if (signal.aborted)
                resolve(false);
            else
                this.approvals.set(entryId, resolve);
        });
    }
    resolveApproval(entryId: number, approved: boolean): void {
        const settle = this.approvals.get(entryId);
        if (!settle)
            return;
        this.approvals.delete(entryId);
        settle(approved);
    }
    private applyMode(modeId: AssistantModeId): void {
        this.modeId = modeId;
        for (const listener of this.modeListeners)
            listener();
    }
    private async respond(): Promise<void> {
        const run = new AbortController();
        this.run = run;
        try {
            await runAgent({ host: this, protocol: this.connection.protocol, endpoint: this.connection.endpoint, signal: run.signal });
        }
        catch (cause) {
            if (run.signal.aborted)
                this.conversation.addNotice('info', 'Resposta interrompida.');
            else
                this.conversation.addNotice('error', describeFailure(cause));
        }
        finally {
            this.run = null;
            this.conversation.endRun();
            if (this.resetRequested) {
                this.resetRequested = false;
                this.conversation.clear();
            }
        }
    }
}
