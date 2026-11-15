import { findAssistantMode, type AssistantMode, type AssistantModeId } from '@/engine/editor/assistant/modes/assistant-mode';
import type { ToolAccess } from '@/engine/editor/assistant/tools/assistant-tool';
export const MCP_ACCESS_MODE_IDS = ['autonomous', 'limited', 'readOnly'] as const satisfies readonly AssistantModeId[];
export type McpAccessModeId = (typeof MCP_ACCESS_MODE_IDS)[number];
export const DEFAULT_MCP_ACCESS_MODE: McpAccessModeId = 'autonomous';
export const MCP_ACCESS_MODES: readonly AssistantMode[] = MCP_ACCESS_MODE_IDS.map(findAssistantMode);
export function isMcpAccessModeId(value: unknown): value is McpAccessModeId {
    return MCP_ACCESS_MODE_IDS.some((id) => id === value);
}
export function allowsAccess(modeId: McpAccessModeId, access: ToolAccess): boolean {
    return findAssistantMode(modeId).permissions[access] === 'allow';
}
