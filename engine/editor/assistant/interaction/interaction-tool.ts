import type { QuestionAnswer } from '@/engine/editor/assistant/conversation/conversation-entry';
import type { ConversationStore } from '@/engine/editor/assistant/conversation/conversation-store';
import type { ToolParameters } from '@/engine/editor/assistant/providers/tool-declaration';
import type { ToolOutput } from '@/engine/editor/assistant/tools/assistant-tool';
import type { ToolInput } from '@/engine/editor/assistant/tools/tool-input';
export interface InteractionContext {
    readonly conversation: ConversationStore;
    awaitAnswer(entryId: number): Promise<QuestionAnswer | null>;
}
export interface InteractionTool {
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolParameters;
    readonly awaitsUser: boolean;
    run(context: InteractionContext, input: ToolInput): ToolOutput | Promise<ToolOutput>;
}
