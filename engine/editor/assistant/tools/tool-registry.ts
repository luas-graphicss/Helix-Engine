import type { ToolDeclaration } from '@/engine/editor/assistant/providers/tool-declaration';
import type { AssistantTool } from './assistant-tool';
import { INSPECTOR_TOOLS } from './inspector-tools';
import { INTERFACE_ELEMENT_TOOLS } from './interface-element-tools';
import { INTERFACE_SCREEN_TOOLS } from './interface-screen-tools';
import { PLAYTEST_TOOLS } from './playtest-tools';
import { PROJECT_TOOLS } from './project-tools';
import { SCENE_TOOLS } from './scene-tools';
import { SCRIPT_TOOLS } from './script-tools';
import { SCRIPTING_REFERENCE_TOOLS } from './scripting-reference-tools';
import { TERRAIN_TOOLS } from './terrain-tools';
export const ASSISTANT_TOOLS: readonly AssistantTool[] = [
    ...PROJECT_TOOLS,
    ...SCENE_TOOLS,
    ...INSPECTOR_TOOLS,
    ...SCRIPT_TOOLS,
    ...SCRIPTING_REFERENCE_TOOLS,
    ...TERRAIN_TOOLS,
    ...INTERFACE_SCREEN_TOOLS,
    ...INTERFACE_ELEMENT_TOOLS,
    ...PLAYTEST_TOOLS,
];
const TOOLS_BY_NAME: ReadonlyMap<string, AssistantTool> = new Map(ASSISTANT_TOOLS.map((tool) => [tool.name, tool]));
export const TOOL_DECLARATIONS: readonly ToolDeclaration[] = ASSISTANT_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
export function findAssistantTool(name: string): AssistantTool | undefined {
    return TOOLS_BY_NAME.get(name);
}
