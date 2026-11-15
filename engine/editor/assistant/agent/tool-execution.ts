import type { QuestionAnswer } from '@/engine/editor/assistant/conversation/conversation-entry';
import type { ConversationStore } from '@/engine/editor/assistant/conversation/conversation-store';
import type { InteractionContext, InteractionTool } from '@/engine/editor/assistant/interaction/interaction-tool';
import { findInteractionTool } from '@/engine/editor/assistant/interaction/interaction-tool-registry';
import type { AssistantMode } from '@/engine/editor/assistant/modes/assistant-mode';
import type { ToolCall } from '@/engine/editor/assistant/providers/chat-protocol';
import type { ToolOutput } from '@/engine/editor/assistant/tools/assistant-tool';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { ToolInput } from '@/engine/editor/assistant/tools/tool-input';
import { findAssistantTool } from '@/engine/editor/assistant/tools/tool-registry';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { detailInput, summarizeInput } from './input-preview';
const OUTPUT_LIMIT = 24000;
const LOG_SOURCE = 'Assistente';
export interface ToolOutcome {
    readonly output: string;
    readonly failed: boolean;
}
export interface ToolExecutionHost {
    readonly session: EditorSession;
    readonly conversation: ConversationStore;
    readonly mode: AssistantMode;
    confirm(entryId: number, signal: AbortSignal): Promise<boolean>;
    ask(entryId: number, signal: AbortSignal): Promise<QuestionAnswer | null>;
}
export const CANCELLED_OUTCOME: ToolOutcome = { output: 'Cancelled: the user stopped the assistant before this tool ran.', failed: true };
export const DEFERRED_OUTCOME: ToolOutcome = { output: 'Not run: this call was sent together with a question to the user. Decide again now that you have the answer.', failed: true };
const DENIED_OUTCOME: ToolOutcome = { output: 'The user denied this action. Do not retry it. Ask how they want to proceed.', failed: true };
function formatOutput(output: ToolOutput): string {
    const rendered = typeof output === 'string' ? output : JSON.stringify(output);
    if (rendered.length <= OUTPUT_LIMIT)
        return rendered || 'Done.';
    return `${rendered.slice(0, OUTPUT_LIMIT)}\n[Output truncated: ${rendered.length - OUTPUT_LIMIT} more characters. Narrow the request.]`;
}
function blockedOutput(mode: AssistantMode): string {
    return `Blocked: the user set the assistant to "${mode.label}" mode, which does not allow this action. Do not retry it. Explain what you intended and that they can switch the mode to allow it.`;
}
function describeFailure(cause: unknown): string {
    if (cause instanceof ToolFailure)
        return cause.message;
    return `The tool failed unexpectedly: ${cause instanceof Error ? cause.message : String(cause)}`;
}
async function runInteractionTool(host: ToolExecutionHost, tool: InteractionTool, call: ToolCall, signal: AbortSignal): Promise<ToolOutcome> {
    if (call.inputError)
        return { output: call.inputError, failed: true };
    const context: InteractionContext = { conversation: host.conversation, awaitAnswer: (entryId) => host.ask(entryId, signal) };
    try {
        return { output: formatOutput(await tool.run(context, new ToolInput(call.input))), failed: false };
    }
    catch (cause) {
        if (!(cause instanceof ToolFailure))
            throw cause;
        return { output: cause.message, failed: true };
    }
}
async function runProjectTool(host: ToolExecutionHost, call: ToolCall, signal: AbortSignal): Promise<ToolOutcome> {
    const { conversation, session } = host;
    const tool = findAssistantTool(call.name);
    const entryId = conversation.addToolCall({ title: tool?.title ?? call.name, summary: summarizeInput(call.input), input: detailInput(call.input), status: 'running', output: '' });
    const fail = (output: string): ToolOutcome => {
        conversation.updateToolCall(entryId, { status: 'failed', output });
        return { output, failed: true };
    };
    if (!tool)
        return fail(`Unknown tool "${call.name}".`);
    if (call.inputError)
        return fail(call.inputError);
    const { mode } = host;
    const permission = mode.permissions[tool.access];
    if (permission === 'deny') {
        const output = blockedOutput(mode);
        conversation.updateToolCall(entryId, { status: 'blocked', output });
        return { output, failed: true };
    }
    if (permission === 'ask') {
        conversation.updateToolCall(entryId, { status: 'awaiting' });
        conversation.setActivity('awaiting');
        if (!(await host.confirm(entryId, signal))) {
            conversation.updateToolCall(entryId, { status: 'denied' });
            return DENIED_OUTCOME;
        }
        conversation.updateToolCall(entryId, { status: 'running' });
    }
    conversation.setActivity('working');
    try {
        const output = formatOutput(await tool.run(session, new ToolInput(call.input)));
        conversation.updateToolCall(entryId, { status: 'done', output });
        return { output, failed: false };
    }
    catch (cause) {
        if (!(cause instanceof ToolFailure))
            session.log.error(LOG_SOURCE, `${tool.title} falhou: ${cause instanceof Error ? cause.message : String(cause)}`);
        return fail(describeFailure(cause));
    }
}
export function executeToolCall(host: ToolExecutionHost, call: ToolCall, signal: AbortSignal): Promise<ToolOutcome> {
    const interaction = findInteractionTool(call.name);
    return interaction ? runInteractionTool(host, interaction, call, signal) : runProjectTool(host, call, signal);
}
