import { findAssistantMode } from '@/engine/editor/assistant/modes/assistant-mode';
import type { ToolOutput } from '@/engine/editor/assistant/tools/assistant-tool';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { ToolInput } from '@/engine/editor/assistant/tools/tool-input';
import type { McpTool, McpToolContext } from '@/engine/editor/mcp/tools/mcp-tool';
import { findMcpTool } from '@/engine/editor/mcp/tools/tool-catalog';
import type { ToolAttachment, ToolCallEvent, ToolCallResult } from '@/engine/mcp/protocol/bridge-messages';
import { allowsAccess, type McpAccessModeId } from './access-policy';
const OUTPUT_LIMIT = 60000;
const LOG_SOURCE = 'MCP';
interface CallReport {
    readonly failed: boolean;
    readonly output: string;
    readonly attachments: readonly ToolAttachment[];
}
function failure(output: string): CallReport {
    return { failed: true, output, attachments: [] };
}
function renderOutput(output: ToolOutput): string {
    const rendered = typeof output === 'string' ? output : JSON.stringify(output);
    if (rendered.length <= OUTPUT_LIMIT)
        return rendered || 'Done.';
    return `${rendered.slice(0, OUTPUT_LIMIT)}\n[Output truncated: ${rendered.length - OUTPUT_LIMIT} more characters. Narrow the request.]`;
}
function blockedOutput(modeId: McpAccessModeId): string {
    return `Blocked: the user set the MCP access to "${findAssistantMode(modeId).label}", which does not allow this action. Do not retry it. Tell the user what you intended so they can raise the access level in the Assistant panel.`;
}
async function runBeforeDeadline(tool: McpTool, context: McpToolContext, call: ToolCallEvent): Promise<CallReport> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ToolFailure('The tool did not finish before the call deadline. It may still complete in the editor.')), call.remainingMs);
    });
    try {
        const { output, attachments = [] } = await Promise.race([tool.run(context, new ToolInput(call.arguments)), deadline]);
        return { failed: false, output: renderOutput(output), attachments };
    }
    finally {
        clearTimeout(timer);
    }
}
async function runTool(context: McpToolContext, modeId: McpAccessModeId, call: ToolCallEvent): Promise<CallReport> {
    const tool = findMcpTool(call.tool);
    if (!tool)
        return failure(`Unknown tool "${call.tool}".`);
    if (!allowsAccess(modeId, tool.access))
        return failure(blockedOutput(modeId));
    try {
        return await runBeforeDeadline(tool, context, call);
    }
    catch (cause) {
        if (cause instanceof ToolFailure)
            return failure(cause.message);
        const message = cause instanceof Error ? cause.message : String(cause);
        context.session.log.error(LOG_SOURCE, `${tool.title} falhou: ${message}`);
        return failure(`The tool failed unexpectedly: ${message}`);
    }
}
export async function executeCall(context: McpToolContext, modeId: McpAccessModeId, call: ToolCallEvent): Promise<ToolCallResult> {
    const startedAt = performance.now();
    const report = await runTool(context, modeId, call);
    return { callId: call.callId, ...report, durationMs: Math.round(performance.now() - startedAt) };
}
