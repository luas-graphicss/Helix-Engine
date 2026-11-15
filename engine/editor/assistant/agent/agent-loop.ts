import type { ChatProtocol, ModelTurn, ProviderEndpoint } from '@/engine/editor/assistant/providers/chat-protocol';
import { TOOL_DECLARATIONS } from '@/engine/editor/assistant/tools/tool-registry';
import { DeltaBuffer } from './delta-buffer';
import { buildSystemPrompt } from './system-prompt';
import { CANCELLED_OUTCOME, executeToolCall, type ToolExecutionHost } from './tool-execution';
const MAX_STEPS = 40;
export interface AgentRun {
    readonly host: ToolExecutionHost;
    readonly protocol: ChatProtocol;
    readonly endpoint: ProviderEndpoint;
    readonly signal: AbortSignal;
}
async function requestTurn({ host, protocol, endpoint, signal }: AgentRun): Promise<ModelTurn> {
    const { conversation, session } = host;
    const deltas = new DeltaBuffer({
        onText: (delta) => conversation.appendAssistantText(delta),
        onToolCall: () => conversation.setActivity('preparing'),
    });
    try {
        return await protocol.complete({
            endpoint,
            system: buildSystemPrompt(session, host.mode),
            messages: conversation.transcript,
            tools: TOOL_DECLARATIONS,
            signal,
            observer: deltas,
        });
    }
    finally {
        deltas.flush();
    }
}
export async function runAgent(run: AgentRun): Promise<void> {
    const { host, signal } = run;
    const { conversation } = host;
    for (let step = 0; step < MAX_STEPS; step++) {
        conversation.setActivity('thinking');
        const turn = await requestTurn(run);
        conversation.commitAssistantTurn(turn);
        if (turn.truncated)
            conversation.addNotice('info', 'A resposta foi cortada pelo limite de saída do modelo.');
        if (turn.toolCalls.length === 0) {
            if (!turn.text.trim())
                conversation.addNotice('info', 'O modelo não respondeu nada. Reformule o pedido.');
            return;
        }
        for (const call of turn.toolCalls) {
            const outcome = signal.aborted ? CANCELLED_OUTCOME : await executeToolCall(host, call, signal);
            conversation.addToolResult(call.id, outcome.output, outcome.failed);
        }
        signal.throwIfAborted();
    }
    conversation.addNotice('info', `O assistente parou após ${MAX_STEPS} passos. Envie "continue" para seguir.`);
}
