import { anthropicProtocol } from './anthropic-protocol';
import type { ChatProtocol, ProtocolId } from './chat-protocol';
import { openAiChatProtocol } from './openai-chat-protocol';
import { openAiResponsesProtocol } from './openai-responses-protocol';
export const CHAT_PROTOCOLS: Record<ProtocolId, ChatProtocol> = {
    anthropic: anthropicProtocol,
    'openai-chat': openAiChatProtocol,
    'openai-responses': openAiResponsesProtocol,
};
