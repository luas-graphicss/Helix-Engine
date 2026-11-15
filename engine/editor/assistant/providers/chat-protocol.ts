import type { JsonRecord } from './json-value';
import type { ToolDeclaration } from './tool-declaration';
export const PROTOCOL_IDS = ['anthropic', 'openai-chat', 'openai-responses'] as const;
export type ProtocolId = (typeof PROTOCOL_IDS)[number];
export const PROTOCOL_LABEL: Record<ProtocolId, string> = {
    anthropic: 'Anthropic Messages',
    'openai-chat': 'OpenAI Chat Completions',
    'openai-responses': 'OpenAI Responses',
};
export const REASONING_EFFORTS = ['auto', 'low', 'medium', 'high'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export interface ProviderEndpoint {
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly model: string;
}
export interface ToolCall {
    readonly id: string;
    readonly name: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly inputError: string | null;
}
export interface NativeTurn {
    readonly protocol: ProtocolId;
    readonly content: readonly JsonRecord[];
}
export interface UserMessage {
    readonly role: 'user';
    readonly text: string;
}
export interface AssistantMessage {
    readonly role: 'assistant';
    readonly text: string;
    readonly toolCalls: readonly ToolCall[];
    readonly native: NativeTurn | null;
}
export interface ToolResultMessage {
    readonly role: 'tool';
    readonly callId: string;
    readonly output: string;
    readonly failed: boolean;
}
export type ChatMessage = UserMessage | AssistantMessage | ToolResultMessage;
export interface TurnObserver {
    onText(delta: string): void;
    onReasoning(delta: string): void;
    onToolCall(name: string): void;
}
export interface ChatRequest {
    readonly endpoint: ProviderEndpoint;
    readonly system: string;
    readonly messages: readonly ChatMessage[];
    readonly tools: readonly ToolDeclaration[];
    readonly signal: AbortSignal;
    readonly reasoningEffort: ReasoningEffort;
    readonly observer: TurnObserver;
}
export interface ModelTurn {
    readonly text: string;
    readonly toolCalls: readonly ToolCall[];
    readonly native: NativeTurn | null;
    readonly truncated: boolean;
}
export interface ChatProtocol {
    complete(request: ChatRequest): Promise<ModelTurn>;
    listModels(endpoint: ProviderEndpoint, signal: AbortSignal): Promise<string[]>;
}
