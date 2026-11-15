import type { ToolParameters } from '@/engine/editor/assistant/providers/tool-declaration';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ToolInput } from './tool-input';
export type ToolAccess = 'read' | 'scene' | 'code' | 'destructive' | 'run';
export type ToolOutput = string | object;
export interface AssistantTool {
    readonly name: string;
    readonly title: string;
    readonly access: ToolAccess;
    readonly description: string;
    readonly parameters: ToolParameters;
    run(session: EditorSession, input: ToolInput): ToolOutput | Promise<ToolOutput>;
}
