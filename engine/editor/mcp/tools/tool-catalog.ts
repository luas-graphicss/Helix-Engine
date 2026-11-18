import { ASSISTANT_TOOLS } from '@/engine/editor/assistant/tools/tool-registry';
import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import { ASSET_DISCOVERY_TOOLS } from './asset-discovery-tools';
import { ASSET_INSERTION_TOOLS } from './asset-insertion-tools';
import { CAPTURE_TOOLS } from './capture-tools';
import { IMPORT_TOOLS } from './import-tools';
import { fromAssistantTool, type McpTool } from './mcp-tool';
const MCP_TOOLS: readonly McpTool[] = [...ASSISTANT_TOOLS.map(fromAssistantTool), ...CAPTURE_TOOLS, ...IMPORT_TOOLS, ...ASSET_DISCOVERY_TOOLS, ...ASSET_INSERTION_TOOLS];
const TOOLS_BY_NAME: ReadonlyMap<string, McpTool> = new Map(MCP_TOOLS.map((tool) => [tool.name, tool]));
export const MCP_TOOL_DESCRIPTORS: readonly ToolDescriptor[] = MCP_TOOLS.map(({ name, title, description, access, parameters }) => ({ name, title, description, access, inputSchema: parameters }));
export function findMcpTool(name: string): McpTool | undefined {
    return TOOLS_BY_NAME.get(name);
}
