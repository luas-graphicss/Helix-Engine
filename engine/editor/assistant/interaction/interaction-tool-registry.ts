import type { ToolDeclaration } from '@/engine/editor/assistant/providers/tool-declaration';
import type { InteractionTool } from './interaction-tool';
import { updatePlanTool } from './plan-tool';
const INTERACTION_TOOLS: readonly InteractionTool[] = [updatePlanTool];
const TOOLS_BY_NAME: ReadonlyMap<string, InteractionTool> = new Map(INTERACTION_TOOLS.map((tool) => [tool.name, tool]));
export const INTERACTION_TOOL_DECLARATIONS: readonly ToolDeclaration[] = INTERACTION_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
export function findInteractionTool(name: string): InteractionTool | undefined {
    return TOOLS_BY_NAME.get(name);
}
