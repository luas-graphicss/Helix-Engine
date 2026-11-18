import type { ToolParameters } from '@/engine/editor/assistant/providers/tool-declaration';
import type { AssistantTool, ToolAccess, ToolOutput } from '@/engine/editor/assistant/tools/assistant-tool';
import type { ToolInput } from '@/engine/editor/assistant/tools/tool-input';
import type { SourcePermissions } from '@/engine/editor/mcp/asset-sources/permissions/source-permissions';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
import type { FileTransfer } from './file-transfer';
export interface McpToolContext {
    readonly session: EditorSession;
    readonly files: FileTransfer;
    readonly sourcePermissions: SourcePermissions;
}
export interface McpToolOutput {
    readonly output: ToolOutput;
    readonly attachments?: readonly ToolAttachment[];
}
export interface McpTool {
    readonly name: string;
    readonly title: string;
    readonly access: ToolAccess;
    readonly description: string;
    readonly parameters: ToolParameters;
    run(context: McpToolContext, input: ToolInput): McpToolOutput | Promise<McpToolOutput>;
}
export function fromAssistantTool(tool: AssistantTool): McpTool {
    const { name, title, access, description, parameters } = tool;
    return { name, title, access, description, parameters, run: async ({ session }, input) => ({ output: await tool.run(session, input) }) };
}
